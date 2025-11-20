export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;

  // Auth check
  const token = request.headers.get("X-Admin-Token");
  if (!token || token !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    if (method === "GET") {
      return handleListImages(context);
    } else if (method === "POST") {
      return handleUploadImage(context);
    } else {
      return new Response("Method not allowed", { status: 405 });
    }
  } catch (error) {
    console.error("Images API Error:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Server error" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleListImages(context) {
  const { env } = context;

  try {
    const list = await env.CALMIQS_IMAGES.list({ prefix: "img:" });
    const images = [];

    for (const key of list.keys) {
      const metadata = await env.CALMIQS_IMAGES.getWithMetadata(key.name);
      if (metadata.value) {
        const imgData = JSON.parse(metadata.value);
        images.push({
          r2Key: imgData.r2Key,
          alt: imgData.alt,
          title: imgData.title,
          filename: imgData.filename,
          uploadedAt: imgData.uploadedAt,
        });
      }
    }

    return new Response(JSON.stringify({ images }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("List images error:", error);
    return new Response(JSON.stringify({ images: [] }), {
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleUploadImage(context) {
  const { request, env } = context;
  const formData = await request.formData();
  const file = formData.get("file");
  const alt = formData.get("alt") || file.name;

  if (!file) {
    return new Response(JSON.stringify({ error: "No file provided" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const arrayBuffer = await file.arrayBuffer();
  const filename = file.name;
  const id = `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const r2Key = `uploads/${id}/${filename}`;

  try {
    // Upload to R2
    await env.R2_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type,
      },
    });

    // Save metadata to KV
    const metadata = {
      r2Key,
      filename,
      alt,
      title: alt,
      uploadedAt: new Date().toISOString(),
    };

    await env.CALMIQS_IMAGES.put(`img:${id}`, JSON.stringify(metadata));

    // Return public URL (adjust domain as needed)
    const publicUrl = `https://calmiqs.pages.dev/images/${encodeURIComponent(
      r2Key
    )}`;

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        r2Key,
        metadata,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Upload error:", error);
    return new Response(
      JSON.stringify({ error: "Upload failed: " + error.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
