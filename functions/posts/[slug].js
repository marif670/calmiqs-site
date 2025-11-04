export async function onRequestGet({ params, env }) {
  try {
    const slug = params.slug;
    const postJSON = await env.CALMIQS_POSTS.get(slug);
    if (!postJSON) return new Response("Post not found", { status: 404 });

    const post = JSON.parse(postJSON);

    // Replace hero image if stored in KV
    if (post.image) {
      const heroMeta = await env.CALMIQS_IMAGES.get(post.image, {
        type: "json",
      });
      if (heroMeta) {
        post.image = `/images/${post.image}`;
        post.imageAlt = heroMeta.alt || post.imageAlt || "Hero image";
      }
    }

    // Replace inline images in content
    // Assuming inline images have <img src="/images/{id}" ...> template
    const contentWithImages = await replaceInlineImages(post.content, env);

    const html = `
      <html>
        <head>
          <title>${post.title}</title>
          <meta name="description" content="${post.excerpt}" />
        </head>
        <body>
          <article>
            <img src="${post.image}" alt="${post.imageAlt}" />
            <h1>${post.title}</h1>
            <p>${post.date}</p>
            <div>${contentWithImages}</div>
          </article>
        </body>
      </html>
    `;

    return new Response(html, { headers: { "Content-Type": "text/html" } });
  } catch (err) {
    return new Response("Error loading post: " + err.message, { status: 500 });
  }
}

// Helper to replace inline image IDs with KV URLs
async function replaceInlineImages(content, env) {
  // Match <img src="/images/{id}" ...>
  return content.replace(
    /<img\s+[^>]*src="\/images\/([^\"]+)"[^>]*>/g,
    async (match, id) => {
      const meta = await env.CALMIQS_IMAGES.get(id, { type: "json" });
      if (!meta) return match; // leave as is if not found
      return `<img src="/images/${id}" alt="${
        meta.alt || "Inline image"
      }" class="my-4 rounded-lg shadow-md" />`;
    }
  );
}
