export const onRequestPost = async ({ request, env }) => {
  try {
    const formData = await request.formData();
    const file = formData.get("file");
    const alt = formData.get("alt") || "";
    const postSlug = formData.get("postSlug") || "default-post";

    if (!file || !file.arrayBuffer) {
      return new Response(
        JSON.stringify({ success: false, error: "No file uploaded" }),
        { status: 400 }
      );
    }

    const buffer = await file.arrayBuffer();
    const id = Date.now() + "-" + file.name.replace(/\s+/g, "-");
    const key = `${postSlug}/${id}`;

    // Save file in KV (as base64)
    const base64 = Buffer.from(buffer).toString("base64");
    await env.CALMIQS_IMAGES.put(key, base64, {
      metadata: { mime: file.type, alt },
    });

    return new Response(
      JSON.stringify({
        success: true,
        id: key,
        url: `/api/images/${key}`,
        meta: { originalName: file.name, mime: file.type, alt, postSlug },
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500 }
    );
  }
};
