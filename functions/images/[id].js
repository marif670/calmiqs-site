export const onRequestGet = async ({ params, env }) => {
  try {
    const key = params.id; // "postSlug/timestamp-filename.jpg"
    const value = await env.CALMIQS_IMAGES.get(key, { type: "arrayBuffer" });

    if (!value) {
      return new Response("Image not found", { status: 404 });
    }

    const metadata = await env.CALMIQS_IMAGES.get(key, { type: "json" });
    const headers = {
      "Content-Type": metadata?.mime || "application/octet-stream",
      "Cache-Control": "public, max-age=31536000",
    };

    return new Response(value, { headers });
  } catch (err) {
    console.error(err);
    return new Response("Error loading image", { status: 500 });
  }
};
