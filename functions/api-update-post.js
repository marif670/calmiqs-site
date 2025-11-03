export async function onRequestPost(context) {
  const { request, env } = context;
  const GITHUB_TOKEN = env.GITHUB_TOKEN; // read from Cloudflare Secrets
  const BLOG_FILE = env.BLOG_FILE || "posts.json";

  try {
    const body = await request.json();
    const { content, commitMessage = "Update posts.json" } = body;

    if (!content) {
      return new Response(JSON.stringify({ error: "Missing content" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }

    // Your GitHub repo details
    const owner = "marif670";
    const repo = "calmiqs-site";
    const path = BLOG_FILE;

    // 1. Get the current file SHA
    const getUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${path}`;
    const currentFile = await fetch(getUrl, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
      },
    });
    const currentData = await currentFile.json();

    // 2. Update the file on GitHub
    const updateResponse = await fetch(getUrl, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: "application/vnd.github.v3+json",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        message: commitMessage,
        content: btoa(unescape(encodeURIComponent(content))),
        sha: currentData.sha,
      }),
    });

    if (!updateResponse.ok) {
      const errorText = await updateResponse.text();
      return new Response(JSON.stringify({ error: "GitHub update failed", details: errorText }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
