export async function onRequestPost(context) {
  try {
    const data = await context.request.json();
    return new Response(JSON.stringify({ success: true, received: data }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
