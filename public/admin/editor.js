document.addEventListener("DOMContentLoaded", () => {
  const loginBtn = document.getElementById("loginBtn");
  const passwordInput = document.getElementById("passwordInput");

  loginBtn.addEventListener("click", (e) => {
    e.preventDefault();
    console.log("Button clicked!"); // Test if JS is firing
    alert("Entered password: " + passwordInput.value);
  });
});
