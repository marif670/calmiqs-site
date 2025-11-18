/* admin/subscribers.js */

(() => {
  const btn = document.getElementById("viewSubscribersBtn");
  if (!btn) return;

  const modal = document.getElementById("subscribersModal");
  const closeBtn = document.getElementById("closeSubscribersBtn");

  const exportBtn = document.getElementById("exportCsvBtn");
  const copyBtn = document.getElementById("copyEmailsBtn");

  const tableBody = document.querySelector("#subscribersTable tbody");

  // Workers.dev based API — no domain yet
  const API_BASE = "https://calmiqs-images-worker.techaipet.workers.dev";

  // Admin token from your CMS authentication
  const ADMIN_TOKEN = window.ADMIN_TOKEN;

  let subscribers = [];

  async function loadSubscribers() {
    const res = await fetch(`${API_BASE}/api/newsletter/subscribers`, {
      headers: { "X-Admin-Token": ADMIN_TOKEN },
    });

    if (!res.ok) {
      alert("Cannot load subscribers: Unauthorized or Worker issue.");
      return;
    }

    subscribers = await res.json();
    renderTable();
  }

  function renderTable() {
    tableBody.innerHTML = "";

    subscribers.forEach((sub) => {
      const tr = document.createElement("tr");
      tr.className = "border-b";

      tr.innerHTML = `
        <td class="py-2">${sub.name || ""}</td>
        <td class="py-2">${sub.email}</td>
        <td class="py-2">${new Date(sub.date).toLocaleString()}</td>
        <td class="py-2">
          <button class="deleteSubBtn px-2 py-1 bg-red-100 text-red-700 rounded"
                  data-email="${sub.email}">
            Delete
          </button>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    // Attach delete events
    document
      .querySelectorAll(".deleteSubBtn")
      .forEach((btn) => btn.addEventListener("click", deleteSubscriber));
  }

  async function deleteSubscriber(e) {
    const email = e.target.dataset.email;
    if (!confirm(`Delete subscriber: ${email}?`)) return;

    const res = await fetch(
      `${API_BASE}/api/newsletter/subscriber?email=${encodeURIComponent(email)}`,
      {
        method: "DELETE",
        headers: { "X-Admin-Token": ADMIN_TOKEN },
      }
    );

    if (res.ok) {
      subscribers = subscribers.filter((s) => s.email !== email);
      renderTable();
    } else {
      alert("Delete failed.");
    }
  }

  exportBtn.addEventListener("click", () => {
    const rows = [["Name", "Email", "Date"]];
    subscribers.forEach((s) => rows.push([s.name || "", s.email, s.date]));

    const csv = rows.map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "calmiqs-subscribers.csv";
    a.click();
  });

  copyBtn.addEventListener("click", async () => {
    const emails = subscribers.map((s) => s.email).join(",");
    await navigator.clipboard.writeText(emails);
    alert("Emails copied.");
  });

  btn.addEventListener("click", () => {
    modal.classList.remove("hidden");
    loadSubscribers();
  });

  closeBtn.addEventListener("click", () => {
    modal.classList.add("hidden");
  });
})();
