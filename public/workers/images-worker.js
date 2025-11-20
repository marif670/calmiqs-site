// images-worker.js
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const pathname = url.pathname;

    // simple auth check using secret header
    const incomingToken = request.headers.get("X-Admin-Token") || "";
    const expected = env.ADMIN_SECRET || "";
    const isAdmin = incomingToken && expected && incomingToken === expected;

    if (pathname === "/api/images/upload" && request.method === "POST") {
      if (!isAdmin) return new Response("Unauthorized", { status: 401 });
      return handleUpload(request, env);
    }

    if (pathname === "/api/images/list" && request.method === "GET") {
      if (!isAdmin) return new Response("Unauthorized", { status: 401 });
      return handleList(request, env);
    }

    if (pathname === "/api/images/update" && request.method === "POST") {
      if (!isAdmin) return new Response("Unauthorized", { status: 401 });
      return handleUpdate(request, env);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function handleUpload(request, env) {
  // parse multipart
  const form = await request.formData();
  const file = form.get("file");
  if (!file) return new Response("No file", { status: 400 });

  const filename = file.name || "upload";
  const arrayBuffer = await file.arrayBuffer();
  const mime = file.type || "application/octet-stream";

  const id = `img-${Date.now()}-${randomHex(6)}`;
  const r2Key = `originals/${id}/${filename}`;

  // put binary in R2
  await env.R2_BUCKET.put(r2Key, arrayBuffer, {
    httpMetadata: { contentType: mime },
    customMetadata: { uploadedAt: new Date().toISOString() },
  });

  // generate metadata record
  const meta = {
    id,
    original: { r2_key: r2Key, mime, size: arrayBuffer.byteLength },
    title: form.get("title") || "",
    caption: form.get("caption") || "",
    alt: generateAltText(filename, form.get("caption") || ""),
    createdAt: new Date().toISOString(),
  };

  await env.CALMIQS_IMAGES.put(`img:${id}`, JSON.stringify(meta));

  // Return minimal metadata for editor
  return new Response(
    JSON.stringify({
      id,
      alt: meta.alt,
      title: meta.title,
      caption: meta.caption,
    }),
    { headers: { "Content-Type": "application/json" } }
  );
}

async function handleList(request, env) {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get("page") || "1", 10);
  const q = url.searchParams.get("q") || "";
  const pageSize = 24;
  const start = (page - 1) * pageSize;
  const end = start + pageSize;

  // List keys from KV (descending is not guaranteed by KV; for robust implementations, store index separately)
  const list = await env.CALMIQS_IMAGES.list({ prefix: "img:", limit: 1000 });
  // list.keys is array of { name }
  // Fetch metadata for each and filter
  const metas = [];
  for (const key of list.keys) {
    const val = await env.CALMIQS_IMAGES.get(key.name);
    if (!val) continue;
    try {
      const obj = JSON.parse(val);
      // simple search
      if (q) {
        const hay = `${obj.title || ""} ${obj.caption || ""} ${obj.id}`.toLowerCase();
        if (!hay.includes(q.toLowerCase())) continue;
      }
      metas.push({
        id: obj.id,
        title: obj.title,
        caption: obj.caption,
        alt: obj.alt,
        createdAt: obj.createdAt,
      });
    } catch (e) {
      /* ignore parse errors */
    }
  }

  // simple pagination
  const pageItems = metas.slice(start, end);
  return new Response(JSON.stringify({ images: pageItems }), {
    headers: { "Content-Type": "application/json" },
  });
}

async function handleUpdate(request, env) {
  const payload = await request.json();
  const { id, alt, title, caption } = payload;
  if (!id) return new Response("Missing id", { status: 400 });
  const key = `img:${id}`;
  const raw = await env.CALMIQS_IMAGES.get(key);
  if (!raw) return new Response("Not found", { status: 404 });
  const meta = JSON.parse(raw);
  if (alt !== undefined) meta.alt = String(alt);
  if (title !== undefined) meta.title = String(title);
  if (caption !== undefined) meta.caption = String(caption);
  await env.CALMIQS_IMAGES.put(key, JSON.stringify(meta));
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "Content-Type": "application/json" },
  });
}

/* Helpers */
function generateAltText(filename, caption) {
  if (caption && caption.trim().length > 3) return sanitize(caption);
  if (filename) {
    let name = filename
      .replace(/\.[^/.]+$/, "")
      .replace(/[-_]+/g, " ")
      .replace(/\b\d+\b/g, "")
      .trim();
    if (name) return name.charAt(0).toUpperCase() + name.slice(1);
  }
  return "Image";
}
function sanitize(s) {
  return String(s)
    .replace(/[\r\n]+/g, " ")
    .trim();
}
function randomHex(len) {
  const a = new Uint8Array(len);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, "0"))
    .join("")
    .slice(0, len);
}
// Newsletter endpoints
if (pathname === "/api/newsletter/subscribe") {
  return handleNewsletterSubscribe(request, env);
}
if (pathname === "/api/newsletter/subscribers") {
  return handleGetSubscribers(request, env);
}
if (pathname === "/api/newsletter/stats") {
  return handleNewsletterStats(request, env);
}
if (pathname === "/api/newsletter/send") {
  return handleSendNewsletter(request, env);
}
// Add these routes to your worker
if (pathname === "/api/newsletter/subscribe" && request.method === "POST") {
  return handleNewsletterSubscribe(request, env);
}
if (pathname === "/api/newsletter/subscribers" && request.method === "GET") {
  if (!isAdmin) return new Response("Unauthorized", { status: 401 });
  return handleGetSubscribers(request, env);
}
if (pathname === "/api/newsletter/stats" && request.method === "GET") {
  if (!isAdmin) return new Response("Unauthorized", { status: 401 });
  return handleNewsletterStats(request, env);
}
if (pathname === "/api/newsletter/send" && request.method === "POST") {
  if (!isAdmin) return new Response("Unauthorized", { status: 401 });
  return handleSendNewsletter(request, env);
}
if (pathname === "/api/newsletter/unsubscribe" && request.method === "POST") {
  return handleUnsubscribe(request, env);
}

// Newsletter Subscribe
async function handleNewsletterSubscribe(request, env) {
  try {
    const payload = await request.json();
    const { email } = payload;

    if (!email || !email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return new Response(JSON.stringify({ error: "Invalid email" }), { status: 400 });
    }

    const subscriptionId = `sub:${email}`;
    const existingSub = await env.CALMIQS_NEWSLETTER.get(subscriptionId);

    if (existingSub) {
      const sub = JSON.parse(existingSub);
      if (sub.status === "active") {
        return new Response(JSON.stringify({ message: "Already subscribed", subscribed: true }), {
          status: 200,
        });
      }
    }

    const subscription = {
      email,
      status: "pending", // pending until confirmed
      subscribedAt: new Date().toISOString(),
      confirmToken: generateToken(),
      unsubscribeToken: generateToken(),
    };

    await env.CALMIQS_NEWSLETTER.put(subscriptionId, JSON.stringify(subscription), {
      expirationTtl: 7 * 24 * 60 * 60, // 7 days for pending
    });

    // TODO: Send confirmation email with link:
    // https://calmiqs.pages.dev/api/newsletter/confirm?token={confirmToken}

    return new Response(
      JSON.stringify({
        message: "Check your email to confirm subscription",
        subscribed: false,
      }),
      { status: 201, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Subscription failed" }), { status: 500 });
  }
}

// Get Subscribers (admin only)
async function handleGetSubscribers(request, env) {
  try {
    const list = await env.CALMIQS_NEWSLETTER.list({ prefix: "sub:" });
    const subscribers = [];

    for (const key of list.keys) {
      const data = await env.CALMIQS_NEWSLETTER.get(key.name);
      if (data) subscribers.push(JSON.parse(data));
    }

    return new Response(JSON.stringify({ subscribers, total: subscribers.length }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to fetch subscribers" }), { status: 500 });
  }
}

// Newsletter Stats
async function handleNewsletterStats(request, env) {
  try {
    const list = await env.CALMIQS_NEWSLETTER.list({ prefix: "sub:" });
    let active = 0,
      unsubscribed = 0;

    for (const key of list.keys) {
      const data = await env.CALMIQS_NEWSLETTER.get(key.name);
      if (data) {
        const sub = JSON.parse(data);
        if (sub.status === "active") active++;
        else if (sub.status === "unsubscribed") unsubscribed++;
      }
    }

    return new Response(
      JSON.stringify({
        total: list.keys.length,
        active,
        unsubscribed,
        pending: list.keys.length - active - unsubscribed,
      }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: "Failed to fetch stats" }), { status: 500 });
  }
}

// Send Newsletter
async function handleSendNewsletter(request, env) {
  try {
    const { subject, content, fromEmail, fromName } = await request.json();

    // Get all active subscribers
    const list = await env.CALMIQS_NEWSLETTER.list({ prefix: "sub:" });
    const activeEmails = [];

    for (const key of list.keys) {
      const data = await env.CALMIQS_NEWSLETTER.get(key.name);
      if (data) {
        const sub = JSON.parse(data);
        if (sub.status === "active") activeEmails.push(sub.email);
      }
    }

    if (activeEmails.length === 0) {
      return new Response(JSON.stringify({ error: "No active subscribers" }), { status: 400 });
    }

    // TODO: Integrate with email service (SendGrid, Mailgun, AWS SES)
    // For now, log the newsletter
    console.log(`Newsletter queued: ${subject} to ${activeEmails.length} subscribers`);

    // Store newsletter record
    const nlId = `newsletter:${Date.now()}`;
    await env.CALMIQS_NEWSLETTER.put(
      nlId,
      JSON.stringify({
        subject,
        content,
        sentAt: new Date().toISOString(),
        recipientCount: activeEmails.length,
        status: "sent",
      })
    );

    return new Response(
      JSON.stringify({
        message: "Newsletter sent",
        recipients: activeEmails.length,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ error: "Send failed" }), { status: 500 });
  }
}

// Unsubscribe
async function handleUnsubscribe(request, env) {
  try {
    const { email } = await request.json();
    const subscriptionId = `sub:${email}`;
    const data = await env.CALMIQS_NEWSLETTER.get(subscriptionId);

    if (!data) {
      return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });
    }

    const sub = JSON.parse(data);
    sub.status = "unsubscribed";
    sub.unsubscribedAt = new Date().toISOString();

    await env.CALMIQS_NEWSLETTER.put(subscriptionId, JSON.stringify(sub));

    return new Response(JSON.stringify({ message: "Unsubscribed" }), { status: 200 });
  } catch (err) {
    return new Response(JSON.stringify({ error: "Unsubscribe failed" }), { status: 500 });
  }
}

// Helpers
function generateToken() {
  return Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
