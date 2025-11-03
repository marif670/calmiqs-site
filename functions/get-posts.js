// /functions/get-posts.js
export async function onRequestGet({ env }) {
  const list = await env.CALMIQS_POSTS.list();
  const results = [];

  for (const key of list.keys) {
    const postData = await env.CALMIQS_POSTS.get(key.name);
    if (postData) {
      try {
        results.push({ id: key.name, ...JSON.parse(postData) });
      } catch {
        console.error("Invalid JSON for key:", key.name);
      }
    }
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { "Content-Type": "application/json" },
  });
}
