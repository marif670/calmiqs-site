export async function onRequestPost({ request, env }) {
  const formData = await request.formData();
  const file = formData.get("file");

  if (!file) {
    return new Response(
      JSON.stringify({ success: false, error: "No file uploaded" }),
      {
        status: 400,
        headers: { "Content-Type": "application/json" },
      }
    );
  }

  const id = Date.now().toString();
  await env.CALMIQS_IMAGES.put(id, file.stream(), {
    metadata: { filename: file.name, type: file.type },
  });

  return new Response(JSON.stringify({ success: true, id }), {
    headers: { "Content-Type": "application/json" },
  });
}
