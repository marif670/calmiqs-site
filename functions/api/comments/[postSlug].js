// functions/api/comments/[postSlug].js
// Handles GET /api/comments/:postSlug (get comments for a post)

function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function onRequestGet(context) {
  const { params, env } = context;
  const postSlug = params.postSlug;

  console.log("GET /api/comments/" + postSlug);

  try {
    const comments = [];
    const list = await env.CALMIQS_POSTS.list({
      prefix: `comments:${postSlug}:`,
    });

    console.log("Found keys:", list.keys.length);

    for (const key of list.keys) {
      const value = await env.CALMIQS_POSTS.get(key.name);
      if (value) {
        const comment = JSON.parse(value);
        // Only return approved comments
        if (comment.status === "approved") {
          comments.push(comment);
        }
      }
    }

    // Sort by date (newest first)
    comments.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    console.log("Returning comments:", comments.length);

    return jsonResponse({ comments }, 200);
  } catch (error) {
    console.error("Error getting comments:", error);
    return jsonResponse({ error: error.message }, 500);
  }
}
