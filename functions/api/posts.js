// functions/api/posts.js
// Handles /api/posts endpoint

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function isAdmin(request, env) {
  const token = request.headers.get("X-Admin-Token");
  const ADMIN_SECRET =
    env.ADMIN_SECRET ||
    "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Hadia@2017_Ayesha@2007";
  return token && token === ADMIN_SECRET;
}

// GET /api/posts
export async function onRequestGet(context) {
  const { env } = context;

  try {
    const posts = {};
    const list = await env.CALMIQS_POSTS.list({ prefix: "post:" });

    for (const key of list.keys) {
      const value = await env.CALMIQS_POSTS.get(key.name);
      if (value) {
        const slug = key.name.replace("post:", "");
        posts[slug] = JSON.parse(value);
      }
    }

    return jsonResponse(posts, 200);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}

// POST /api/posts (create/update post)
export async function onRequestPost(context) {
  const { request, env } = context;

  if (!isAdmin(request, env)) {
    return jsonResponse({ error: "Unauthorized" }, 401);
  }

  try {
    const { slug, data } = await request.json();

    if (!slug || !data) {
      return jsonResponse({ error: "Missing slug or data" }, 400);
    }

    data.updatedAt = new Date().toISOString();
    if (!data.createdAt) data.createdAt = data.updatedAt;

    await env.CALMIQS_POSTS.put(`post:${slug}`, JSON.stringify(data));

    return jsonResponse({ success: true, slug }, 200);
  } catch (error) {
    return jsonResponse({ error: error.message }, 500);
  }
}
