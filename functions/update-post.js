// /functions/update-post.js
export async function onRequestPost({ request, env }) {
  try {
    const body = await request.json();
    const { key, data } = body;

    if (!key || !data) {
      return new Response(
        JSON.stringify({ success: false, error: "Missing key or data" }),
        {
          status: 400,
          headers: { "Content-Type": "application/json" },
        }
      );
    }

    await env.CALMIQS_POSTS.put(key, JSON.stringify(data));

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      }
    );
  }
}
