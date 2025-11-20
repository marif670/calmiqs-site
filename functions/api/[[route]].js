// functions/api/[[route]].js
// Simple route handler for Cloudflare Pages Functions

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname.replace("/api", "");

  console.log("Route:", pathname, "Method:", request.method);

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  try {
    const token = request.headers.get("X-Admin-Token");
    const isAdmin =
      token ===
      (env.ADMIN_SECRET ||
        "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Hadia@2017_Ayesha@2007");

    // ===== POSTS =====
    if (pathname === "/posts" && request.method === "GET") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const posts = [];
        const list = await env.CALMIQS_POSTS.list({ prefix: "post:" });

        console.log("KV list keys:", list.keys.length);

        for (const key of list.keys) {
          const data = await env.CALMIQS_POSTS.get(key.name);
          if (data) {
            posts.push(JSON.parse(data));
          }
        }

        posts.sort((a, b) => new Date(b.date) - new Date(a.date));

        return new Response(
          JSON.stringify({
            success: true,
            posts,
            total: posts.length,
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      } catch (err) {
        console.error("Posts error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // ===== GET SINGLE POST =====
    if (pathname.match(/^\/posts\//) && request.method === "GET") {
      const slug = pathname.split("/").pop();
      try {
        const data = await env.CALMIQS_POSTS.get(`post:${slug}`);
        if (!data) {
          return new Response(JSON.stringify({ error: "Not found" }), {
            status: 404,
            headers: corsHeaders,
          });
        }
        return new Response(data, {
          status: 200,
          headers: corsHeaders,
        });
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // ===== SAVE POST =====
    if (pathname === "/posts" && request.method === "POST") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const postData = await request.json();
        const key = `post:${postData.slug}`;
        const post = {
          ...postData,
          updatedAt: new Date().toISOString(),
        };

        await env.CALMIQS_POSTS.put(key, JSON.stringify(post));

        return new Response(
          JSON.stringify({
            success: true,
            message: "Post saved",
            slug: postData.slug,
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // ===== DELETE POST =====
    if (pathname.match(/^\/posts\//) && request.method === "DELETE") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const slug = pathname.split("/").pop();
        await env.CALMIQS_POSTS.delete(`post:${slug}`);

        return new Response(
          JSON.stringify({
            success: true,
            message: "Post deleted",
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // ===== IMAGES =====
    if (pathname === "/upload" && request.method === "POST") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const formData = await request.formData();
        const file = formData.get("file");

        if (!file) {
          return new Response(JSON.stringify({ error: "No file" }), {
            status: 400,
            headers: corsHeaders,
          });
        }

        const arrayBuffer = await file.arrayBuffer();
        const timestamp = Date.now();
        const randomId = Math.random().toString(36).substring(7);
        const r2Key = `uploads/${timestamp}-${randomId}/${file.name}`;

        await env.R2_BUCKET.put(r2Key, arrayBuffer, {
          httpMetadata: {
            contentType: file.type || "application/octet-stream",
          },
        });

        const metaKey = `img:${timestamp}-${randomId}`;
        const metadata = {
          r2Key,
          filename: file.name,
          alt: formData.get("alt") || file.name,
          title: formData.get("title") || file.name,
          uploadedAt: new Date().toISOString(),
        };

        await env.CALMIQS_IMAGES.put(metaKey, JSON.stringify(metadata));

        const fileUrl = `${
          new URL(request.url).origin
        }/files/${encodeURIComponent(r2Key)}`;

        return new Response(
          JSON.stringify({
            success: true,
            url: fileUrl,
            r2Key,
            metadata,
          }),
          {
            status: 200,
            headers: corsHeaders,
          }
        );
      } catch (err) {
        console.error("Upload error:", err);
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // ===== LIST IMAGES =====
    if (pathname === "/list" && request.method === "GET") {
      if (!isAdmin) {
        return new Response(JSON.stringify({ error: "Unauthorized" }), {
          status: 401,
          headers: corsHeaders,
        });
      }

      try {
        const images = [];
        const list = await env.CALMIQS_IMAGES.list({ prefix: "img:" });

        for (const key of list.keys) {
          const data = await env.CALMIQS_IMAGES.get(key.name);
          if (data) {
            images.push(JSON.parse(data));
          }
        }

        images.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

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
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders,
        });
      }
    }

    // ===== FILE SERVING =====
    if (pathname.startsWith("/files/")) {
      const key = decodeURIComponent(pathname.replace("/files/", ""));
      try {
        const file = await env.R2_BUCKET.get(key);

        if (!file) {
          return new Response("Not found", { status: 404 });
        }

        return new Response(file.body, {
          headers: {
            "Content-Type":
              file.httpMetadata?.contentType || "application/octet-stream",
            "Cache-Control": "max-age=31536000",
            "Access-Control-Allow-Origin": "*",
          },
        });
      } catch (err) {
        return new Response("Error", { status: 500 });
      }
    }

    // ===== DEFAULT 404 =====
    return new Response(JSON.stringify({ error: "Not found" }), {
      status: 404,
      headers: corsHeaders,
    });
  } catch (err) {
    console.error("Handler error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
