// functions/api/newsletter/subscribe.js
// Newsletter subscription

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
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
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

    console.log(`[NEWSLETTER] Subscribe request for: ${email}`);

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
        console.log(`[NEWSLETTER] Already subscribed: ${email}`);
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

    // Create subscription
    const subscription = {
      email,
      name: sanitizedName,
      status: "active",
      subscribedAt: new Date().toISOString(),
      ip: request.headers.get("CF-Connecting-IP") || "unknown",
    };

    // Store in KV
    await env.CALMIQS_NEWSLETTER.put(
      subscriptionId,
      JSON.stringify(subscription),
      { expirationTtl: 365 * 24 * 60 * 60 } // 1 year
    );

    console.log(`[NEWSLETTER] Subscribed: ${email}`);

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
