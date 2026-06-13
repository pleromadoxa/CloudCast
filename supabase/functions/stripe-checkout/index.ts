import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@17";
import {
  appPublicUrl,
  isStripeConfigured,
  resolveStripePriceId,
  STRIPE_PRODUCT_LABELS,
} from "../_shared/stripeConfig.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function stripeClient(): Stripe {
  const key = Deno.env.get("STRIPE_SECRET_KEY");
  if (!key) throw new Error("Stripe is not configured");
  return new Stripe(key, { apiVersion: "2025-02-24.acacia" });
}

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function getUser(req: Request) {
  const authHeader = req.headers.get("authorization");
  if (!authHeader) return null;
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return user;
}

async function getOrCreateCustomer(
  stripe: Stripe,
  admin: ReturnType<typeof createClient>,
  userId: string,
  email: string | undefined,
): Promise<string> {
  const { data: profile } = await admin
    .from("profiles")
    .select("stripe_customer_id, full_name")
    .eq("id", userId)
    .single();

  if (profile?.stripe_customer_id) {
    return profile.stripe_customer_id as string;
  }

  const customer = await stripe.customers.create({
    email: email ?? undefined,
    name: (profile?.full_name as string | null) ?? undefined,
    metadata: { supabase_user_id: userId },
  });

  await admin.from("profiles").update({ stripe_customer_id: customer.id }).eq("id", userId);
  return customer.id;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return json({ enabled: isStripeConfigured() });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  const body = await req.json().catch(() => ({}));
  const action = String(body.action ?? "checkout");

  if (action === "status") {
    return json({ enabled: isStripeConfigured() });
  }

  if (!isStripeConfigured()) {
    return json({ error: "Stripe billing is not configured" }, 503);
  }

  const user = await getUser(req);
  if (!user) {
    return json({ error: "Unauthorized" }, 401);
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  const stripe = stripeClient();
  const base = appPublicUrl();

  try {
    if (action === "portal") {
      const customerId = await getOrCreateCustomer(stripe, admin, user.id, user.email);
      const portal = await stripe.billingPortal.sessions.create({
        customer: customerId,
        return_url: `${base}/profile`,
      });
      return json({ url: portal.url });
    }

    const product = String(body.product ?? "");
    const planId = String(body.plan_id ?? "");

    if (action === "checkout") {
      if (!product || !planId || planId === "free") {
        return json({ error: "product and paid plan_id required" }, 400);
      }

      const priceId = resolveStripePriceId(product, planId);
      if (!priceId) {
        return json({ error: `No Stripe price configured for ${product} ${planId}` }, 400);
      }

      const customerId = await getOrCreateCustomer(stripe, admin, user.id, user.email);
      const label = STRIPE_PRODUCT_LABELS[product] ?? product;

      const session = await stripe.checkout.sessions.create({
        customer: customerId,
        mode: "subscription",
        line_items: [{ price: priceId, quantity: 1 }],
        allow_promotion_codes: true,
        success_url: `${base}/pricing?checkout=success&product=${encodeURIComponent(product)}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${base}/pricing?product=${encodeURIComponent(product)}&checkout=canceled`,
        client_reference_id: user.id,
        metadata: {
          user_id: user.id,
          product,
          plan_id: planId,
        },
        subscription_data: {
          metadata: {
            user_id: user.id,
            product,
            plan_id: planId,
          },
        },
        custom_text: {
          submit: {
            message: `${label} — billed monthly. Manage or cancel anytime from your CloudCast profile.`,
          },
        },
      });

      if (!session.url) {
        return json({ error: "Could not create checkout session" }, 500);
      }

      return json({ url: session.url, session_id: session.id });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("[stripe-checkout]", e);
    return json({ error: e instanceof Error ? e.message : "Checkout failed" }, 500);
  }
});
