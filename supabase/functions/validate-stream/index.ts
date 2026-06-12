import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { validateRtmpDestination } from "./rtmpClient.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const streamUrl = String(body.stream_url ?? "").trim();
    const streamKey = String(body.stream_key ?? "").trim();

    if (!streamUrl || !streamKey) {
      return new Response(
        JSON.stringify({
          ok: false,
          message: "Stream URL and stream key are required.",
          stage: "format",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const result = await validateRtmpDestination(streamUrl, streamKey);
    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({
        ok: false,
        message: e instanceof Error ? e.message : "Validation failed.",
        stage: "connect",
      }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
