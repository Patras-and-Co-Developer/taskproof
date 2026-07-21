// =====================================================================
//  check-screenshot  —  Supabase Edge Function
//
//  The browser sends: the screenshot (as base64), the checklist step text,
//  and the property address. This function asks Gemini whether the image
//  genuinely shows that step for that property, then returns pass / flag.
//
//  The Gemini API key is read from a secret stored in Supabase — it never
//  goes to the browser and never appears in the code on GitHub.
// =====================================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
// Gemini's fast, low-cost vision model — fine for this kind of check.
const GEMINI_URL =
  "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

// Allow the browser app to call this function.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  // Browsers send a preflight OPTIONS request first — answer it.
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { imageBase64, imageMimeType, stepText, propertyAddress } = await req.json();

    if (!imageBase64 || !stepText || !propertyAddress) {
      return json({ status: "flag", note: "Missing image, step, or property address." });
    }
    if (!GEMINI_API_KEY) {
      return json({ status: "flag", note: "Server is not configured with a Gemini key yet." });
    }

    // The instruction we give Gemini. We ask for a strict JSON reply so the
    // app can read it reliably.
    const prompt =
      `You are checking evidence for a property management task.\n\n` +
      `The property manager was asked to complete this step:\n"${stepText}"\n\n` +
      `The task is for this property address:\n"${propertyAddress}"\n\n` +
      `Look at the attached screenshot and decide:\n` +
      `1. Does the screenshot plausibly show that this step was done?\n` +
      `2. If the image shows an address, property name, or reference, does it match the property above? ` +
      `(If no address is visible, do not fail it on that alone.)\n\n` +
      `Reply with ONLY a JSON object, no other text, in exactly this form:\n` +
      `{"status":"pass","note":"short reason"} or {"status":"flag","note":"short reason"}\n` +
      `Use "flag" if the image is unclear, blank, unrelated to the step, or clearly for a different property.`;

    const geminiRes = await fetch(`${GEMINI_URL}?key=${GEMINI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt },
              { inline_data: { mime_type: imageMimeType || "image/png", data: imageBase64 } },
            ],
          },
        ],
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error("Gemini error:", errText);
      // Fail safe: if the AI call fails, flag for manual review rather than
      // silently passing something unchecked.
      return json({ status: "flag", note: "Could not check automatically — needs manual review." });
    }

    const data = await geminiRes.json();
    const raw = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Gemini sometimes wraps JSON in ```json fences — strip them.
    const cleaned = raw.replace(/```json/gi, "").replace(/```/g, "").trim();

    let result;
    try {
      result = JSON.parse(cleaned);
    } catch {
      result = { status: "flag", note: "AI reply could not be read — needs manual review." };
    }

    // Only ever return pass or flag.
    const status = result.status === "pass" ? "pass" : "flag";
    const note = typeof result.note === "string" ? result.note : "Checked.";

    return json({ status, note });
  } catch (e) {
    console.error("Function error:", e);
    return json({ status: "flag", note: "Something went wrong checking this image." });
  }
});

function json(body: unknown) {
  return new Response(JSON.stringify(body), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
