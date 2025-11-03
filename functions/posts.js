export async function onRequestGet(context) {
  const { CALMIQS_POSTS } = context.env;

  try {
    const posts = await CALMIQS_POSTS.get("posts", "json"); // Fetch JSON from KV
    if (!posts) {
      return new Response(JSON.stringify({}), {
        status: 404,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(posts), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
