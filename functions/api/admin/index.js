// functions/api/admin/index.js - UNIFIED ADMIN DASHBOARD

export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const path = url.pathname;

  // Admin auth check
  const token = request.headers.get("X-Admin-Token");
  const ADMIN_SECRET =
    env.ADMIN_SECRET ||
    "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Hadia@2017_Ayesha@2007";
  const isAdmin = token === ADMIN_SECRET;

  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, X-Admin-Token",
    "Content-Type": "application/json",
  };

  if (request.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (!isAdmin) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: corsHeaders,
    });
  }

  // UNIFIED ROUTES

  // GET /api/admin/dashboard - Get all admin data
  if (path === "/api/admin/dashboard" && request.method === "GET") {
    try {
      const [posts, comments, subscribers] = await Promise.all([
        getPostsData(env),
        getCommentsData(env),
        getNewsletterStats(env),
      ]);

      return new Response(
        JSON.stringify({
          posts,
          comments,
          subscribers,
        }),
        { headers: corsHeaders }
      );
    } catch (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // POST /api/admin/posts - Create/Update post
  if (path === "/api/admin/posts" && request.method === "POST") {
    return handleSavePost(request, env, corsHeaders);
  }

  // GET /api/admin/posts/:slug - Get specific post
  if (path.match(/^\/api\/admin\/posts\/[^\/]+$/) && request.method === "GET") {
    const slug = path.split("/").pop();
    return handleGetPost(slug, env, corsHeaders);
  }

  // DELETE /api/admin/posts/:slug - Delete post
  if (
    path.match(/^\/api\/admin\/posts\/[^\/]+$/) &&
    request.method === "DELETE"
  ) {
    const slug = path.split("/").pop();
    return handleDeletePost(slug, env, corsHeaders);
  }

  // GET /api/admin/comments - Get ALL comments
  if (path === "/api/admin/comments" && request.method === "GET") {
    return handleGetAllComments(env, corsHeaders);
  }

  // POST /api/admin/comments/:postSlug/:commentId/approve - Approve comment
  if (
    path.match(/^\/api\/admin\/comments\/[^\/]+\/[^\/]+\/approve$/) &&
    request.method === "POST"
  ) {
    const parts = path.split("/");
    const postSlug = parts[4];
    const commentId = parts[5];
    return handleModerateComment(
      postSlug,
      commentId,
      "approve",
      env,
      corsHeaders
    );
  }

  // POST /api/admin/comments/:postSlug/:commentId/reject - Reject comment
  if (
    path.match(/^\/api\/admin\/comments\/[^\/]+\/[^\/]+\/reject$/) &&
    request.method === "POST"
  ) {
    const parts = path.split("/");
    const postSlug = parts[4];
    const commentId = parts[5];
    return handleModerateComment(
      postSlug,
      commentId,
      "reject",
      env,
      corsHeaders
    );
  }

  // DELETE /api/admin/comments/:postSlug/:commentId - Delete comment
  if (
    path.match(/^\/api\/admin\/comments\/[^\/]+\/[^\/]+$/) &&
    request.method === "DELETE"
  ) {
    const parts = path.split("/");
    const postSlug = parts[4];
    const commentId = parts[5];
    return handleDeleteComment(postSlug, commentId, env, corsHeaders);
  }

  return new Response(JSON.stringify({ error: "Not found" }), {
    status: 404,
    headers: corsHeaders,
  });
}

// ========== POST HANDLERS ==========

async function handleSavePost(request, env, corsHeaders) {
  const body = await request.json();
  const {
    slug,
    title,
    content,
    excerpt,
    image,
    imageAlt,
    category,
    tags,
    author,
    date,
  } = body;

  if (!slug || !title) {
    return new Response(JSON.stringify({ error: "Missing slug or title" }), {
      status: 400,
      headers: corsHeaders,
    });
  }

  const post = {
    slug,
    title,
    content,
    excerpt: excerpt || "",
    image: image || "",
    imageAlt: imageAlt || "",
    category: category || "blog",
    tags: tags || [],
    author: author || "Calmiqs Team",
    date: date || new Date().toISOString().split("T")[0],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  try {
    await env.CALMIQS_POSTS.put(`post:${slug}`, JSON.stringify(post));
    return new Response(JSON.stringify({ success: true, slug }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleGetPost(slug, env, corsHeaders) {
  try {
    const post = await env.CALMIQS_POSTS.get(`post:${slug}`);
    if (!post) {
      return new Response(JSON.stringify({ error: "Post not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }
    return new Response(post, { headers: corsHeaders });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleDeletePost(slug, env, corsHeaders) {
  try {
    await env.CALMIQS_POSTS.delete(`post:${slug}`);

    // Also delete associated comments
    const list = await env.CALMIQS_POSTS.list({ prefix: `comments:${slug}:` });
    for (const key of list.keys) {
      await env.CALMIQS_POSTS.delete(key.name);
    }

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function getPostsData(env) {
  const posts = [];
  const list = await env.CALMIQS_POSTS.list({ prefix: "post:" });

  for (const key of list.keys) {
    const post = await env.CALMIQS_POSTS.get(key.name);
    if (post) {
      posts.push(JSON.parse(post));
    }
  }

  return posts.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}

// ========== COMMENT HANDLERS ==========

async function handleGetAllComments(env, corsHeaders) {
  try {
    const comments = [];
    const list = await env.CALMIQS_POSTS.list({ prefix: "comments:" });

    for (const key of list.keys) {
      const comment = await env.CALMIQS_POSTS.get(key.name);
      if (comment) {
        comments.push(JSON.parse(comment));
      }
    }

    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    return new Response(
      JSON.stringify({
        comments,
        stats: {
          total: comments.length,
          pending: comments.filter((c) => c.status === "pending").length,
          approved: comments.filter((c) => c.status === "approved").length,
          rejected: comments.filter((c) => c.status === "rejected").length,
        },
      }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleModerateComment(
  postSlug,
  commentId,
  action,
  env,
  corsHeaders
) {
  try {
    const kvKey = `comments:${postSlug}:${commentId}`;
    const commentData = await env.CALMIQS_POSTS.get(kvKey);

    if (!commentData) {
      return new Response(JSON.stringify({ error: "Comment not found" }), {
        status: 404,
        headers: corsHeaders,
      });
    }

    const comment = JSON.parse(commentData);
    comment.status = action === "approve" ? "approved" : "rejected";
    comment.moderatedAt = new Date().toISOString();

    await env.CALMIQS_POSTS.put(kvKey, JSON.stringify(comment));

    return new Response(
      JSON.stringify({ success: true, status: comment.status }),
      {
        status: 200,
        headers: corsHeaders,
      }
    );
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function handleDeleteComment(postSlug, commentId, env, corsHeaders) {
  try {
    const kvKey = `comments:${postSlug}:${commentId}`;
    await env.CALMIQS_POSTS.delete(kvKey);

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: corsHeaders,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: corsHeaders,
    });
  }
}

async function getCommentsData(env) {
  const comments = [];
  const list = await env.CALMIQS_POSTS.list({ prefix: "comments:" });

  for (const key of list.keys) {
    const comment = await env.CALMIQS_POSTS.get(key.name);
    if (comment) {
      comments.push(JSON.parse(comment));
    }
  }

  return comments;
}

// ========== NEWSLETTER HANDLERS ==========

async function getNewsletterStats(env) {
  try {
    const list = await env.CALMIQS_NEWSLETTER.list({ prefix: "sub:" });
    let active = 0,
      pending = 0,
      unsubscribed = 0;

    for (const key of list.keys) {
      const sub = await env.CALMIQS_NEWSLETTER.get(key.name);
      if (sub) {
        const data = JSON.parse(sub);
        if (data.status === "active") active++;
        else if (data.status === "pending") pending++;
        else if (data.status === "unsubscribed") unsubscribed++;
      }
    }

    return {
      total: list.keys.length,
      active,
      pending,
      unsubscribed,
    };
  } catch (error) {
    console.error("Newsletter stats error:", error);
    return { total: 0, active: 0, pending: 0, unsubscribed: 0 };
  }
}
