export async function onRequestGet({ env }) {
  try {
    const posts = (await env.CALMIQS_POSTS.get("posts", "json")) || [];
    return new Response(JSON.stringify(posts), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
