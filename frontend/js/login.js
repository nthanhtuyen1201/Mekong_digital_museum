document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  const toggleBtn = document.getElementById("togglePassword");
  const passwordInput = document.getElementById("password");
  const msg = document.getElementById("loginMsg");
  const spinner = document.getElementById("loadingSpinner");
  const loginBtn = document.getElementById("loginBtn");

  // Ngăn copy/paste mật khẩu
  passwordInput.addEventListener("paste", (e) => e.preventDefault());
  passwordInput.addEventListener("copy", (e) => e.preventDefault());

  // Toggle hiển thị mật khẩu
  toggleBtn.addEventListener("click", () => {
    const type = passwordInput.type === "password" ? "text" : "password";
    passwordInput.type = type;
    toggleBtn.textContent = type === "password" ? "" : "";
  });

  // Xử lý đăng nhập
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msg.textContent = "";
    spinner.style.display = "block";
    loginBtn.disabled = true;

    const username = document.getElementById("username").value.trim();
    const password = passwordInput.value.trim();

    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();

      if (data.success) {
        msg.style.color = "#90ee90";
        msg.textContent = "Đăng nhập thành công! Đang chuyển hướng...";
        document.body.classList.add("fade-out");

        setTimeout(() => {
          window.location.href = "admin.html";
        }, 1200);
      } else {
        msg.textContent = "Sai tài khoản hoặc mật khẩu!";
      }
    } catch (err) {
      msg.textContent = "Lỗi kết nối. Vui lòng thử lại!";
    } finally {
      spinner.style.display = "none";
      loginBtn.disabled = false;
    }
  });
});

// Hiệu ứng fade-out khi chuyển trang
document.body.addEventListener("animationend", () => {
  if (document.body.classList.contains("fade-out")) {
    document.body.style.opacity = 0;
  }
});
