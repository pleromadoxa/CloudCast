import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import { resolveStripePriceId } from "../_shared/stripeConfig.ts";

const UNIVERSAL_PLANS = ["universal", "universal_essential", "universal_studio"] as const;
type BillablePlan = "free" | "pro" | "pro_master" | (typeof UNIVERSAL_PLANS)[number];

function stripeClient(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

function planFromSubscription(
  product: string,
  planIdMeta: string | undefined,
  priceId: string | undefined,
): BillablePlan {
  if (planIdMeta && UNIVERSAL_PLANS.includes(planIdMeta as (typeof UNIVERSAL_PLANS)[number])) {
    return planIdMeta as BillablePlan;
  }
  if (product === "universal" && planIdMeta === "universal") return "universal";
  if (planIdMeta === "pro" || planIdMeta === "pro_master") return planIdMeta;

  if (priceId) {
    for (const plan of UNIVERSAL_PLANS) {
      if (resolveStripePriceId("universal", plan) === priceId) return plan;
    }
    for (const plan of ["pro_master", "pro"] as const) {
      if (resolveStripePriceId(product, plan) === priceId) return plan;
    }
  }

  return "free";
}

async function applyBilling(
  admin: ReturnType<typeof createClient>,
  input: {
    userId: string;
    product: string;
    planId: BillablePlan;
    customerId: string | null;
    subscriptionId: string | null;
    priceId: string | null;
    status: string;
    periodEnd: number | null;
    cancelAtPeriodEnd: boolean;
  },
) {
  const { error } = await admin.rpc("apply_stripe_billing_update", {
    p_user_id: input.userId,
    p_product: input.product,
    p_plan_id: input.planId,
    p_stripe_customer_id: input.customerId,
    p_stripe_subscription_id: input.subscriptionId,
    p_stripe_price_id: input.priceId,
    p_status: input.status,
    p_period_end: input.periodEnd ? new Date(input.periodEnd * 1000).toISOString() : null,
    p_cancel_at_period_end: input.cancelAtPeriodEnd,
  });
  if (error) throw error;
}

async function resolveUserId(
  admin: ReturnType<typeof createClient>,
  metadata: Stripe.Metadata | null,
  customerId: string | null,
): Promise<string | null> {
  const fromMeta = metadata?.user_id ?? metadata?.supabase_user_id;
  if (fromMeta) return String(fromMeta);

  if (customerId) {
    const { data } = await admin
      .from("profiles")
      .select("id")
      .eq("stripe_customer_id", customerId)
      .maybeSingle();
    if (data?.id) return data.id as string;
  }

  return null;
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405 });
  }

  const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!webhookSecret) {
    return new Response("Webhook secret not configured", { status: 503 });
  }

  const stripe = stripeClient();
  const signature = req.headers.get("stripe-signature");
  if (!signature) {
    return new Response("Missing stripe-signature", { status: 400 });
  }

  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
  } catch (err) {
    console.error("[stripe-webhook] signature verification failed", err);
    return new Response("Invalid signature", { status: 400 });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription") break;

        const userId = await resolveUserId(admin, session.metadata, session.customer as string | null);
        const product = session.metadata?.product;
        const planIdMeta = session.metadata?.plan_id;
        if (!userId || !product) break;

        const subscriptionId = typeof session.subscription === "string"
          ? session.subscription
          : session.subscription?.id ?? null;

        let sub: Stripe.Subscription | null = null;
        if (subscriptionId) {
          sub = await stripe.subscriptions.retrieve(subscriptionId);
        }

        const priceId = sub?.items.data[0]?.price?.id ?? null;
        const planId = planFromSubscription(product, planIdMeta, priceId);

        await applyBilling(admin, {
          userId,
          product,
          planId,
          customerId: session.customer as string | null,
          subscriptionId,
          priceId,
          status: sub?.status ?? "active",
          periodEnd: sub?.current_period_end ?? null,
          cancelAtPeriodEnd: sub?.cancel_at_period_end ?? false,
        });
        break;
      }

      case "customer.subscription.updated":
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const product = sub.metadata?.product;
        const userId = await resolveUserId(admin, sub.metadata, sub.customer as string | null);
        if (!userId || !product) break;

        const priceId = sub.items.data[0]?.price?.id ?? null;
        const planId = event.type === "customer.subscription.deleted"
          ? "free"
          : planFromSubscription(product, sub.metadata?.plan_id, priceId);

        await applyBilling(admin, {
          userId,
          product,
          planId,
          customerId: sub.customer as string | null,
          subscriptionId: sub.id,
          priceId,
          status: sub.status,
          periodEnd: sub.current_period_end ?? null,
          cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        });
        break;
      }

      case "invoice.payment_failed": {
        const invoice = event.data.object as Stripe.Invoice;
        const subId = typeof invoice.subscription === "string"
          ? invoice.subscription
          : invoice.subscription?.id;
        if (!subId) break;
        const sub = await stripe.subscriptions.retrieve(subId);
        const product = sub.metadata?.product;
        const userId = await resolveUserId(admin, sub.metadata, sub.customer as string | null);
        if (!userId || !product) break;

        const priceId = sub.items.data[0]?.price?.id ?? null;
        const planId = planFromSubscription(product, sub.metadata?.plan_id, priceId);

        await applyBilling(admin, {
          userId,
          product,
          planId,
          customerId: sub.customer as string | null,
          subscriptionId: sub.id,
          priceId,
          status: sub.status,
          periodEnd: sub.current_period_end ?? null,
          cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
        });
        break;
      }

      default:
        break;
    }

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("[stripe-webhook]", event.type, e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Handler failed" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
