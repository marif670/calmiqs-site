export async function onRequest(context) {
  const { request, env } = context;
  const method = request.method;
  const url = new URL(request.url);

  try {
    if (method === "GET") {
      return handleGetComments(context);
    } else if (method === "POST") {
      return handleAddComment(context);
    } else if (method === "PUT") {
      return handleApproveComment(context);
    } else if (method === "DELETE") {
      return handleDeleteComment(context);
    }
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

async function handleGetComments(context) {
  const { env } = context;
  const url = new URL(context.request.url);
  const postSlug = url.searchParams.get("post");

  if (!postSlug) {
    return new Response(JSON.stringify({ error: "Post slug required" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const list = await env.CALMIQS_COMMENTS.list({
    prefix: `comment:${postSlug}:`,
  });
  const comments = [];

  for (const key of list.keys) {
    const comment = await env.CALMIQS_COMMENTS.get(key.name, "json");
    if (comment && comment.approved) {
      comments.push(comment);
    }
  }

  return new Response(JSON.stringify({ comments }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleAddComment(context) {
  const { env, request } = context;
  const { postSlug, author, email, content } = await request.json();

  if (!postSlug || !author || !email || !content) {
    return new Response(JSON.stringify({ error: "Missing fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const commentId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const comment = {
    id: commentId,
    postSlug,
    author,
    email,
    content,
    approved: false,
    createdAt: new Date().toISOString(),
  };

  await env.CALMIQS_COMMENTS.put(
    `comment:${postSlug}:${commentId}`,
    JSON.stringify(comment)
  );

  return new Response(JSON.stringify({ success: true, id: commentId }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleApproveComment(context) {
  const { env, request } = context;

  // Verify admin token
  const token = request.headers.get("X-Admin-Token");
  if (!token || token !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { postSlug, commentId } = await request.json();
  const comment = await env.CALMIQS_COMMENTS.get(
    `comment:${postSlug}:${commentId}`,
    "json"
  );

  if (!comment) {
    return new Response(JSON.stringify({ error: "Comment not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  comment.approved = true;
  await env.CALMIQS_COMMENTS.put(
    `comment:${postSlug}:${commentId}`,
    JSON.stringify(comment)
  );

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleDeleteComment(context) {
  const { env, request } = context;

  // Verify admin token
  const token = request.headers.get("X-Admin-Token");
  if (!token || token !== env.ADMIN_SECRET) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const url = new URL(request.url);
  const postSlug = url.searchParams.get("post");
  const commentId = url.searchParams.get("id");

  await env.CALMIQS_COMMENTS.delete(`comment:${postSlug}:${commentId}`);

  return new Response(JSON.stringify({ success: true }), {
    headers: { "Content-Type": "application/json" },
  });
}
