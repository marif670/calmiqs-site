export async function onRequest(context) {
  const { request, env } = context;
  const { CALMIQS_POSTS } = env;
  const url = new URL(request.url);
  const keyParam = url.searchParams.get("key");

  try {
    // GET requests
    if (request.method === "GET") {
      if (keyParam) {
        // Return single post
        const post = await CALMIQS_POSTS.get(keyParam, "json");
        if (!post) {
          return new Response(JSON.stringify({ error: "Post not found" }), {
            status: 404,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(JSON.stringify(post), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      } else {
        // Return all posts
        const list = await CALMIQS_POSTS.list();
        const posts = {};
        for (const item of list.keys) {
          const value = await CALMIQS_POSTS.get(item.name, "json");
          posts[item.name] = value;
        }
        return new Response(JSON.stringify(posts), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    // POST requests → create/update a post
    if (request.method === "POST") {
      const body = await request.json();
      const { key, data } = body;
      if (!key || !data) {
        return new Response(JSON.stringify({ error: "Missing key or data" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      await CALMIQS_POSTS.put(key, JSON.stringify(data));
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // DELETE requests → remove a post
    if (request.method === "DELETE") {
      if (!keyParam) {
        return new Response(JSON.stringify({ error: "Missing key" }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
      await CALMIQS_POSTS.delete(keyParam);
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Method not allowed
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
