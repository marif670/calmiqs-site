// functions/api/posts.js
export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const method = request.method;
  const key = url.searchParams.get("key");

  // ✅ GET all posts
  if (method === "GET" && !key) {
    const list = await env.CALMIQS_POSTS.list();
    const all = {};
    for (const item of list.keys) {
      const value = await env.CALMIQS_POSTS.get(item.name, { type: "json" });
      all[item.name] = value;
    }
    return new Response(JSON.stringify(all), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ✅ GET single post
  if (method === "GET" && key) {
    const post = await env.CALMIQS_POSTS.get(key, { type: "json" });
    if (!post)
      return new Response(JSON.stringify({ error: "Not found" }), {
        status: 404,
      });
    return new Response(JSON.stringify(post), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ✅ CREATE / UPDATE post
  if (method === "POST") {
    const body = await request.json();
    await env.CALMIQS_POSTS.put(body.key, JSON.stringify(body.data));
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  // ✅ DELETE post
  if (method === "DELETE" && key) {
    await env.CALMIQS_POSTS.delete(key);
    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ error: "Invalid method" }), {
    status: 405,
  });
}
