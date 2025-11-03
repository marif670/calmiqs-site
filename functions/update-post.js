export async function onRequestPost({ request, env }) {
  try {
    const post = await request.json();
    if (!post.slug) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing 'slug' field" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fetch existing posts
    const existing = (await env.CALMIQS_POSTS.get("posts", "json")) || [];

    // Update or add the post
    const index = existing.findIndex((p) => p.slug === post.slug);
    if (index >= 0) existing[index] = post;
    else existing.push(post);

    // Save back to KV
    await env.CALMIQS_POSTS.put("posts", JSON.stringify(existing));

    return new Response(
      JSON.stringify({
        success: true,
        message: "Post updated",
        count: existing.length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}
