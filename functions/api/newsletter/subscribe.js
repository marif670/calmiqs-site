// functions/api/newsletter/subscribe.js

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function sanitize(str) {
  return String(str).trim().slice(0, 100);
}

export async function onRequest(context) {
  const { request, env } = context;

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = await request.json();
    const { email, name } = body;

    // Validation
    if (!email || !validateEmail(email)) {
      return new Response(JSON.stringify({ error: "Invalid email address" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sanitizedName = sanitize(name || "Subscriber");
    const subscriptionId = `sub:${email}`;

    // Check if already subscribed
    const existing = await env.CALMIQS_NEWSLETTER.get(subscriptionId);
    if (existing) {
      const sub = JSON.parse(existing);
      if (sub.status === "active") {
        return new Response(
          JSON.stringify({
            success: true,
            message: "Already subscribed",
          }),
          {
            status: 200,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }

    // Create subscription record
    const subscription = {
      email,
      name: sanitizedName,
      status: "active", // Auto-approve for now (can implement double opt-in later)
      subscribedAt: new Date().toISOString(),
      ip: request.headers.get("CF-Connecting-IP") || "unknown",
    };

    // Store in KV (keep for 1 year)
    await env.CALMIQS_NEWSLETTER.put(
      subscriptionId,
      JSON.stringify(subscription),
      { expirationTtl: 365 * 24 * 60 * 60 }
    );

    return new Response(
      JSON.stringify({
        success: true,
        message: "Successfully subscribed to newsletter!",
      }),
      {
        status: 201,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  } catch (error) {
    console.error("Subscribe error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
}
