export async function onRequest(context) {
  return new Response(JSON.stringify({ success: true, message: "Function reached" }), {
    headers: { "Content-Type": "application/json" },
  });
}
