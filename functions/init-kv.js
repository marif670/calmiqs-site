// /functions/init-kv.js
export async function onRequestGet(context) {
  const { env } = context;

  // Example posts (replace with your real posts.json content)
  const posts = {
    "mindful-breathing": {
      title: "The Art of Mindful Breathing",
      date: "November 2, 2025",
      image: "https://via.placeholder.com/800x400?text=Mindful+Breathing",
      excerpt: "Learn how controlled breathing enhances mindfulness and calm.",
      content: "<p>Mindful breathing allows you to focus on your breath...</p>",
    },
    "eco-habits": {
      title: "5 Small Eco Habits That Reduce Stress",
      date: "November 4, 2025",
      image: "https://via.placeholder.com/800x400?text=Eco+Habits",
      excerpt: "Simple sustainability practices to boost serenity.",
      content: "<p>Living sustainably doesn't have to be overwhelming...</p>",
    },
  };

  // Store all posts in KV
  for (const [key, value] of Object.entries(posts)) {
    await env.CALMIQS_POSTS.put(key, JSON.stringify(value));
  }

  return new Response("✅ KV Initialized successfully with blog posts!");
}
