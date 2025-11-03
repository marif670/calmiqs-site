// --- Calmiqs Main Script ---
// Handles breathing tool and any global site behavior

document.addEventListener("DOMContentLoaded", () => {
  const circle = document.getElementById("breathingCircle");
  const instruction = document.getElementById("instructionText");
  const startButton = document.getElementById("startButton");

  // If not on tools page, stop here
  if (!circle || !instruction || !startButton) return;

  let cycle; // interval tracker
  startButton.addEventListener("click", () => {
    if (cycle) return; // prevent multiple clicks
    startButton.disabled = true;
    instruction.textContent = "Get Ready...";
    setTimeout(startSession, 2000);
  });

  function startSession() {
    let phase = 0;

    function breatheCycle() {
      phase = (phase + 1) % 4;

      switch (phase) {
        case 0:
          instruction.textContent = "Breathe In...";
          circle.style.transform = "scale(1.5)";
          circle.style.boxShadow = "0 0 60px rgba(79, 164, 154, 0.8)";
          break;
        case 1:
          instruction.textContent = "Hold...";
          break;
        case 2:
          instruction.textContent = "Breathe Out...";
          circle.style.transform = "scale(1)";
          circle.style.boxShadow = "0 0 25px rgba(79, 164, 154, 0.5)";
          break;
        case 3:
          instruction.textContent = "Hold...";
          break;
      }
    }

    breatheCycle();
    cycle = setInterval(breatheCycle, 4000);
  }
});
// 🎯 3D Tilt Effect on Hover
const cards = document.querySelectorAll(".card");

cards.forEach((card) => {
  card.addEventListener("mousemove", (e) => {
    const rect = card.getBoundingClientRect();
    const x = e.clientX - rect.left; // X position inside card
    const y = e.clientY - rect.top; // Y position inside card
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Calculate rotation limits
    const rotateX = ((y - centerY) / 20) * -1;
    const rotateY = (x - centerX) / 20;

    card.style.transform = `rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale(1.05)`;
  });

  card.addEventListener("mouseleave", () => {
    card.style.transform = "rotateX(0deg) rotateY(0deg) scale(1)";
  });
});
