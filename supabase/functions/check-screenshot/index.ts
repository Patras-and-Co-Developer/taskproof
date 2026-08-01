// =====================================================================
//  check-screenshot  —  Supabase Edge Function (Claude / Anthropic)
//
//  Called ONLY when the free OCR check couldn't confirm the address.
//  Claude looks at the screenshot and judges two things in one lean call:
//    1. Does it match what the step is asking?
//    2. Is it for the right property?
//
//  The Anthropic API key is read from a Supabase secret — never in the
//  browser, never in the code on GitHub.
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-6"; // strong vision, sensible cost

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    const { stepText, propertyAddress } = body;
    // Accept either a list of images (new) or a single image (older callers).
    const images = Array.isArray(body.images) && body.images.length
      ? body.images
      : (body.imageBase64 ? [{ data: body.imageBase64, mime: body.imageMimeType }] : []);

    if (images.length === 0 || !stepText || !propertyAddress) {
      return json({ status: "flag", note: "Missing image, step, or property address." });
    }
    if (!ANTHROPIC_API_KEY) {
      return json({ status: "unavailable", note: "AI check not configured." });
    }

    // Lean prompt: minimal tokens, strict JSON out.
    const prompt =
      `Property management evidence check.\n` +
      `Step required: "${stepText}"\n` +
      `Property: "${propertyAddress}"\n` +
      (images.length > 1
        ? `${images.length} files are attached; together they should evidence the step. `
        : ``) +
      `Reply ONLY with JSON: ` +
      `{"status":"pass","note":"<=8 words"} or {"status":"flag","note":"<=8 words"}. ` +
      `Flag if the evidence doesn't show the step being done, or is clearly a different property. ` +
      `If no address is visible, judge on the step content alone.`;

    const res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 100,
        messages: [
          {
            role: "user",
            content: [
              ...images.map((im) => ({
                type: "image",
                source: { type: "base64", media_type: im.mime || "image/png", data: im.data },
              })),
              { type: "text", text: prompt },
            ],
          },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error("Anthropic error:", errText);
      return json({ status: "unavailable", note: "AI check unavailable." });
    }

    const data = await res.json();
    const raw = (data?.content?.[0]?.text || "").trim();
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = { status: "flag", note: "AI reply unreadable — manual review." };
    }

    const status = result.status === "pass" ? "pass" : "flag";
    const note = typeof result.note === "string" ? result.note : "Checked.";
    return json({ status, note });
  } catch (e) {
    console.error("Function error:", e);
    return json({ status: "unavailable", note: "AI check unavailable." });
  }
});

function json(body) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
