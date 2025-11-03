export async function onRequestPost(context) {
  try {
    // Parse incoming post data
    const newPost = await context.request.json();

    // Path to your JSON data file
    const dataPath = "/assets/data/posts.json";

    // Read existing file
    const existingFile = await context.env.ASSETS.fetch(new URL(dataPath, context.request.url));
    const existingPosts = existingFile.ok ? await existingFile.json() : [];

    // Append new post
    existingPosts.push({
      ...newPost,
      updatedAt: new Date().toISOString(),
    });

    // ⚠️ Note: Cloudflare Pages Functions can't directly write to /public.
    // You’ll need to push updates to GitHub or an external API.
    // For now, we just simulate the save:
    console.log("Updated posts:", existingPosts.length);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Received new post (simulated save).",
        totalPosts: existingPosts.length,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
