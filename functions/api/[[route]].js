// functions/api/[[route]].js
// This file handles ALL requests to /api/* and other routes
// Cloudflare automatically routes everything through this catch-all

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const pathname = url.pathname;

  // CORS headers for all responses
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
  };

  // Handle CORS preflight
  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: corsHeaders,
    });
  }

  // Auth check
  const incomingToken = request.headers.get("X-Admin-Token") || "";
  const expectedToken =
    env.ADMIN_SECRET ||
    "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Hadia@2017_Ayesha@2007";
  const isAdmin = incomingToken === expectedToken;

  try {
    // ==================== IMAGE ROUTES ====================

    // Upload image
    if (pathname === "/upload" && request.method === "POST") {
      if (!isAdmin)
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      return await handleUpload(request, env, corsHeaders);
    }

    // List images
    if (pathname === "/list" && request.method === "GET") {
      if (!isAdmin)
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      return await handleListImages(request, env, corsHeaders);
    }

    // Serve image file from R2
    if (pathname.startsWith("/files/")) {
      const key = decodeURIComponent(pathname.replace("/files/", ""));
      return await handleServeFile(key, env, corsHeaders);
    }

    // Delete image
    if (pathname.startsWith("/delete/") && request.method === "DELETE") {
      if (!isAdmin)
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      const key = decodeURIComponent(pathname.replace("/delete/", ""));
      return await handleDeleteFile(key, env, corsHeaders);
    }

    // ==================== POSTS ROUTES ====================

    // Get all posts
    if (pathname === "/api/posts" && request.method === "GET") {
      if (!isAdmin)
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      return await handleGetAllPosts(request, env, corsHeaders);
    }

    // Create/Update post
    if (pathname === "/api/posts" && request.method === "POST") {
      if (!isAdmin)
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      return await handleSavePost(request, env, corsHeaders);
    }

    // Get single post
    if (pathname.match(/^\/api\/posts\/[^/]+$/) && request.method === "GET") {
      const slug = pathname.split("/").pop();
      return await handleGetPost(slug, env, corsHeaders);
    }

    // Delete post
    if (
      pathname.match(/^\/api\/posts\/[^/]+$/) &&
      request.method === "DELETE"
    ) {
      if (!isAdmin)
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      const slug = pathname.split("/").pop();
      return await handleDeletePost(slug, env, corsHeaders);
    }

    // ==================== NEWSLETTER ROUTES ====================

    // Subscribe
    if (pathname === "/api/newsletter/subscribe" && request.method === "POST") {
      return await handleNewsletterSubscribe(request, env, corsHeaders);
    }

    // Get subscribers
    if (
      pathname === "/api/newsletter/subscribers" &&
      request.method === "GET"
    ) {
      if (!isAdmin)
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      return await handleGetSubscribers(env, corsHeaders);
    }

    // Get stats
    if (pathname === "/api/newsletter/stats" && request.method === "GET") {
      if (!isAdmin)
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      return await handleNewsletterStats(env, corsHeaders);
    }

    // Send newsletter
    if (pathname === "/api/newsletter/send" && request.method === "POST") {
      if (!isAdmin)
        return new Response("Unauthorized", {
          status: 401,
          headers: corsHeaders,
        });
      return await handleSendNewsletter(request, env, corsHeaders);
    }

    // Unsubscribe
    if (
      pathname === "/api/newsletter/unsubscribe" &&
      request.method === "POST"
    ) {
      return await handleUnsubscribe(request, env, corsHeaders);
    }

    // 404
    return jsonResponse({ error: "Route not found" }, 404, corsHeaders);
  } catch (err) {
    console.error("Function error:", err);
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

// ==================== HELPER FUNCTIONS ====================

function jsonResponse(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
  });
}

// ==================== IMAGE HANDLERS ====================

async function handleUpload(request, env, corsHeaders) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file) {
      return jsonResponse({ error: "No file provided" }, 400, corsHeaders);
    }

    const arrayBuffer = await file.arrayBuffer();
    const filename = file.name || "upload";
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(7);
    const r2Key = `uploads/${timestamp}-${randomId}/${filename}`;

    // Upload to R2
    await env.R2_BUCKET.put(r2Key, arrayBuffer, {
      httpMetadata: {
        contentType: file.type || "application/octet-stream",
      },
      customMetadata: {
        uploadedAt: new Date().toISOString(),
        alt: formData.get("alt") || filename,
      },
    });

    // Store metadata in KV
    const metaKey = `img:${timestamp}-${randomId}`;
    const metadata = {
      r2Key,
      filename,
      alt: formData.get("alt") || filename,
      title: formData.get("title") || filename,
      uploadedAt: new Date().toISOString(),
    };

    await env.CALMIQS_IMAGES.put(metaKey, JSON.stringify(metadata));

    // Return response with file URL (use current domain)
    const fileUrl = `${new URL(request.url).origin}/files/${encodeURIComponent(
      r2Key
    )}`;

    return jsonResponse(
      {
        success: true,
        url: fileUrl,
        r2Key,
        metadata,
        message: "File uploaded successfully",
      },
      200,
      corsHeaders
    );
  } catch (err) {
    console.error("Upload error:", err);
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

async function handleListImages(request, env, corsHeaders) {
  try {
    const images = [];

    // List all metadata from KV
    const list = await env.CALMIQS_IMAGES.list({ prefix: "img:" });

    for (const key of list.keys) {
      const data = await env.CALMIQS_IMAGES.get(key.name);
      if (data) {
        const metadata = JSON.parse(data);
        images.push(metadata);
      }
    }

    // Sort by upload date (newest first)
    images.sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt));

    return jsonResponse(
      {
        success: true,
        images,
        total: images.length,
      },
      200,
      corsHeaders
    );
  } catch (err) {
    console.error("List images error:", err);
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

async function handleServeFile(key, env, corsHeaders) {
  try {
    const file = await env.R2_BUCKET.get(key);

    if (!file) {
      return new Response("File not found", {
        status: 404,
        headers: corsHeaders,
      });
    }

    const headers = {
      "Content-Type":
        file.httpMetadata?.contentType || "application/octet-stream",
      "Cache-Control": "max-age=31536000, immutable",
      "Access-Control-Allow-Origin": "*",
    };

    return new Response(file.body, { headers });
  } catch (err) {
    console.error("Serve file error:", err);
    return new Response("Error retrieving file", {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleDeleteFile(key, env, corsHeaders) {
  try {
    await env.R2_BUCKET.delete(key);

    // Find and delete metadata
    const list = await env.CALMIQS_IMAGES.list({ prefix: "img:" });
    for (const metaKey of list.keys) {
      const data = await env.CALMIQS_IMAGES.get(metaKey.name);
      if (data) {
        const metadata = JSON.parse(data);
        if (metadata.r2Key === key) {
          await env.CALMIQS_IMAGES.delete(metaKey.name);
          break;
        }
      }
    }

    return jsonResponse(
      { success: true, message: "File deleted" },
      200,
      corsHeaders
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

// ==================== POST HANDLERS ====================

async function handleGetAllPosts(request, env, corsHeaders) {
  try {
    const posts = [];
    const list = await env.CALMIQS_POSTS.list({ prefix: "post:" });

    for (const key of list.keys) {
      const data = await env.CALMIQS_POSTS.get(key.name);
      if (data) {
        const post = JSON.parse(data);
        posts.push(post);
      }
    }

    // Sort by date (newest first)
    posts.sort((a, b) => new Date(b.date) - new Date(a.date));

    return jsonResponse(
      {
        success: true,
        posts,
        total: posts.length,
      },
      200,
      corsHeaders
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

async function handleGetPost(slug, env, corsHeaders) {
  try {
    const key = `post:${slug}`;
    const data = await env.CALMIQS_POSTS.get(key);

    if (!data) {
      return jsonResponse({ error: "Post not found" }, 404, corsHeaders);
    }

    const post = JSON.parse(data);
    return jsonResponse(post, 200, corsHeaders);
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

async function handleSavePost(request, env, corsHeaders) {
  try {
    const postData = await request.json();
    const key = `post:${postData.slug}`;

    const post = {
      ...postData,
      updatedAt: new Date().toISOString(),
    };

    await env.CALMIQS_POSTS.put(key, JSON.stringify(post));

    return jsonResponse(
      {
        success: true,
        message: "Post saved",
        slug: postData.slug,
      },
      200,
      corsHeaders
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

async function handleDeletePost(slug, env, corsHeaders) {
  try {
    const key = `post:${slug}`;
    await env.CALMIQS_POSTS.delete(key);

    return jsonResponse(
      {
        success: true,
        message: "Post deleted",
      },
      200,
      corsHeaders
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

// ==================== NEWSLETTER HANDLERS ====================

async function handleNewsletterSubscribe(request, env, corsHeaders) {
  try {
    const { email } = await request.json();

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return jsonResponse({ error: "Invalid email" }, 400, corsHeaders);
    }

    const subId = `sub:${email}`;
    const existing = await env.CALMIQS_NEWSLETTER.get(subId);

    if (existing) {
      const sub = JSON.parse(existing);
      if (sub.status === "active") {
        return jsonResponse(
          {
            message: "Already subscribed",
            subscribed: true,
          },
          200,
          corsHeaders
        );
      }
    }

    const subscription = {
      email,
      status: "active",
      subscribedAt: new Date().toISOString(),
    };

    await env.CALMIQS_NEWSLETTER.put(subId, JSON.stringify(subscription));

    return jsonResponse(
      {
        success: true,
        message: "Subscribed successfully",
        subscribed: true,
      },
      201,
      corsHeaders
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

async function handleGetSubscribers(env, corsHeaders) {
  try {
    const subscribers = [];
    const list = await env.CALMIQS_NEWSLETTER.list({ prefix: "sub:" });

    for (const key of list.keys) {
      const data = await env.CALMIQS_NEWSLETTER.get(key.name);
      if (data) {
        subscribers.push(JSON.parse(data));
      }
    }

    return jsonResponse(
      {
        success: true,
        subscribers,
        total: subscribers.length,
      },
      200,
      corsHeaders
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

async function handleNewsletterStats(env, corsHeaders) {
  try {
    const list = await env.CALMIQS_NEWSLETTER.list({ prefix: "sub:" });
    let active = 0,
      unsubscribed = 0;

    for (const key of list.keys) {
      const data = await env.CALMIQS_NEWSLETTER.get(key.name);
      if (data) {
        const sub = JSON.parse(data);
        if (sub.status === "active") active++;
        else if (sub.status === "unsubscribed") unsubscribed++;
      }
    }

    return jsonResponse(
      {
        success: true,
        total: list.keys.length,
        active,
        unsubscribed,
        pending: list.keys.length - active - unsubscribed,
      },
      200,
      corsHeaders
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

async function handleSendNewsletter(request, env, corsHeaders) {
  try {
    const { subject, content, fromEmail, fromName } = await request.json();

    const list = await env.CALMIQS_NEWSLETTER.list({ prefix: "sub:" });
    const activeEmails = [];

    for (const key of list.keys) {
      const data = await env.CALMIQS_NEWSLETTER.get(key.name);
      if (data) {
        const sub = JSON.parse(data);
        if (sub.status === "active") activeEmails.push(sub.email);
      }
    }

    if (activeEmails.length === 0) {
      return jsonResponse({ error: "No active subscribers" }, 400, corsHeaders);
    }

    // TODO: Send actual emails via SendGrid, Mailgun, etc.
    console.log(
      `Newsletter queued: ${subject} to ${activeEmails.length} subscribers`
    );

    const nlId = `newsletter:${Date.now()}`;
    await env.CALMIQS_NEWSLETTER.put(
      nlId,
      JSON.stringify({
        subject,
        sentAt: new Date().toISOString(),
        recipientCount: activeEmails.length,
        status: "sent",
      })
    );

    return jsonResponse(
      {
        success: true,
        message: "Newsletter sent",
        recipients: activeEmails.length,
      },
      200,
      corsHeaders
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}

async function handleUnsubscribe(request, env, corsHeaders) {
  try {
    const { email } = await request.json();
    const subId = `sub:${email}`;
    const data = await env.CALMIQS_NEWSLETTER.get(subId);

    if (!data) {
      return jsonResponse({ error: "Subscriber not found" }, 404, corsHeaders);
    }

    const sub = JSON.parse(data);
    sub.status = "unsubscribed";
    sub.unsubscribedAt = new Date().toISOString();

    await env.CALMIQS_NEWSLETTER.put(subId, JSON.stringify(sub));

    return jsonResponse(
      {
        success: true,
        message: "Unsubscribed",
      },
      200,
      corsHeaders
    );
  } catch (err) {
    return jsonResponse({ error: err.message }, 500, corsHeaders);
  }
}
