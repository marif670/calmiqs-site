export const onRequestPost = async ({ request, env }) => {
  try {
    // Make sure it's a multipart/form-data request
    const formData = await request.formData();
    const file = formData.get("file"); // file input
    const alt = formData.get("alt") || ""; // optional alt text
    const postSlug = formData.get("postSlug") || "";

    if (!file || !file.arrayBuffer) {
      return new Response(
        JSON.stringify({ success: false, error: "No file uploaded" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Generate a unique ID
    const id = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;

    // Convert file to ArrayBuffer and store in KV
    const buffer = await file.arrayBuffer();
    const fileName = file.name || "image.jpg";
    const mimeType = file.type || "application/octet-stream";

    const meta = {
      id,
      mime: mimeType,
      originalName: fileName,
      alt: alt || fileName,
      postSlug,
      size: buffer.byteLength,
      uploadedAt: new Date().toISOString(),
      url: `/images/${id}`,
    };

    // Store the file itself
    await env.CALMIQS_IMAGES.put(id, buffer, { metadata: meta });

    // Return JSON to editor
    return new Response(JSON.stringify({ success: true, ...meta }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Upload failed:", err);
    return new Response(
      JSON.stringify({ success: false, error: "Upload failed" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
