// functions/images/upload.js

export const onRequestPost = async ({ request, env }) => {
  try {
    // Only accept POST
    if (request.method !== "POST") {
      return new Response(
        JSON.stringify({ success: false, error: "Method not allowed" }),
        {
          status: 405,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Parse form-data
    const formData = await request.formData();
    const file = formData.get("file");
    let alt = formData.get("alt") || "";

    if (!file || !file.name || !file.arrayBuffer) {
      return new Response(
        JSON.stringify({ success: false, error: "No file provided" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    // Generate unique ID for KV key
    const id = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;

    // Convert file to ArrayBuffer
    const arrayBuffer = await file.arrayBuffer();

    // Save file in KV
    await env.CALMIQS_IMAGES.put(id, arrayBuffer, {
      metadata: {
        mime: file.type,
        originalName: file.name,
        alt: alt,
        uploadedAt: new Date().toISOString(),
      },
    });

    // Construct URL (Pages function endpoint)
    const url = `/images/${id}`;

    // Response structure
    const response = {
      success: true,
      id: id,
      url: url,
      meta: {
        id,
        mime: file.type,
        originalName: file.name,
        alt: alt,
        uploadedAt: new Date().toISOString(),
        url: url,
      },
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error(err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
};
