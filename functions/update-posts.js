// functions/update-posts.js
export async function onRequestPost(context) {
  const GITHUB_TOKEN = context.env.GITHUB_TOKEN;
  const REPO_OWNER = "marif670";
  const REPO_NAME = "calmiqs-site";
  const FILE_PATH = "assets/data/posts.json";
  const AUTH_PASSWORD = "calmiqs2025";

  try {
    const body = await context.request.json();
    const { password, posts } = body;

    if (password !== AUTH_PASSWORD) {
      return new Response("Unauthorized", { status: 401 });
    }

    // Get the current commit sha of the file
    const getFile = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
      {
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
      }
    );
    const fileData = await getFile.json();
    const sha = fileData.sha;

    // Encode and commit new content
    const newContent = btoa(unescape(encodeURIComponent(JSON.stringify(posts, null, 2))));
    const commit = await fetch(
      `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/contents/${FILE_PATH}`,
      {
        method: "PUT",
        headers: {
          Authorization: `token ${GITHUB_TOKEN}`,
          Accept: "application/vnd.github+json",
        },
        body: JSON.stringify({
          message: "Update posts.json via Calmiqs Editor",
          content: newContent,
          sha,
        }),
      }
    );

    if (!commit.ok) {
      const errText = await commit.text();
      return new Response(`GitHub commit failed: ${errText}`, { status: 500 });
    }

    return new Response("✅ posts.json updated successfully!", { status: 200 });
  } catch (err) {
    return new Response(`Error: ${err.message}`, { status: 500 });
  }
}
