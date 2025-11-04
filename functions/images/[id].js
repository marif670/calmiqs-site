export async function onRequestGet({ params, env }) {
  const id = params.id;
  const kv = env.CALMIQS_IMAGES;

  // Get the image from KV
  const stored = await kv.get(id, { type: "arrayBuffer" });
  if (!stored) return new Response("Image not found", { status: 404 });

  // Get MIME type metadata
  const metaRaw = await kv.get(id + ":meta", { type: "json" });
  const mime = metaRaw?.mime || "application/octet-stream";

  return new Response(stored, {
    status: 200,
    headers: { "Content-Type": mime },
  });
}
