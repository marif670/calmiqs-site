// ============================================
// functions/list.js - FIXED VERSION
// ============================================

export async function onRequest(context) {
  const { request, env } = context;

  // Debug: Log what we received
  console.log("List endpoint called");
  console.log("env keys:", Object.keys(env));
  console.log("CALMIQS_IMAGES available:", !!env.CALMIQS_IMAGES);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  // Auth check
  const token = request.headers.get("X-Admin-Token");
  const expectedToken =
    "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Hadia@2017_Ayesha@2007";

  console.log("Received token:", token ? "yes" : "no");
  console.log("Expected token:", expectedToken ? "yes" : "no");

  const isAdmin = token && token === expectedToken;

  if (!isAdmin) {
    console.log("Auth failed");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  try {
    // CRITICAL: Check if KV binding exists
    if (!env.CALMIQS_IMAGES) {
      console.error("ERROR: CALMIQS_IMAGES KV namespace not bound!");
      console.error("Available env bindings:", Object.keys(env));

      return new Response(
        JSON.stringify({
          error: "Internal error",
          detail: "KV namespace CALMIQS_IMAGES not configured",
          availableBindings: Object.keys(env),
        }),
        {
          status: 500,
          headers: corsHeaders,
        }
      );
    }

    console.log("KV binding exists, attempting to list...");

    const images = [];

    // List all keys with prefix "img:"
    const listResult = await env.CALMIQS_IMAGES.list({ prefix: "img:" });
    console.log("KV list result:", listResult);
    console.log("Images in KV:", listResult.keys.length);

    // Fetch metadata for each image
    for (const key of listResult.keys) {
      try {
        const data = await env.CALMIQS_IMAGES.get(key.name);

        if (data) {
          try {
            const metadata = JSON.parse(data);
            images.push({
              id: metadata.id || key.name,
              r2Key: metadata.r2Key,
              filename: metadata.filename,
              title: metadata.title,
              alt: metadata.alt,
              uploadedAt: metadata.uploadedAt,
              createdAt: metadata.createdAt,
            });
          } catch (parseErr) {
            console.error(
              `Failed to parse metadata for ${key.name}:`,
              parseErr
            );
          }
        }
      } catch (getErr) {
        console.error(`Failed to get ${key.name}:`, getErr);
      }
    }

    console.log("Returning images:", images.length);

    // Sort by date (newest first)
    images.sort((a, b) => {
      const dateA = new Date(b.uploadedAt || b.createdAt || 0);
      const dateB = new Date(a.uploadedAt || a.createdAt || 0);
      return dateA - dateB;
    });

    return new Response(
      JSON.stringify({
        success: true,
        images,
        total: images.length,
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (err) {
    console.error("List error:", err);
    console.error("Error stack:", err.stack);

    return new Response(
      JSON.stringify({
        error: "Internal error",
        detail: err.message,
        stack: err.stack,
      }),
      {
        status: 500,
        headers: corsHeaders,
      }
    );
  }
}
