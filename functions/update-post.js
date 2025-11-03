export async function onRequestPost(context) {
  try {
    const { request, env } = context;
    const data = await request.json();

    const response = {
      message: "Function executed successfully",
      received: data,
    };

    return new Response(JSON.stringify(response, null, 2), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
