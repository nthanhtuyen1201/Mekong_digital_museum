let currentType = "artifacts";
let currentData = [];

// 🔹 Tải dữ liệu theo loại hoặc từ khóa
async function loadData(type = "artifacts", query = "") {
  const container = document.getElementById("dataList");
  container.innerHTML = "<p>Đang tải dữ liệu...</p>";

  try {
    const url = query
      ? `/api/search?q=${encodeURIComponent(query)}`
      : `/api/${type}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error("Không thể tải dữ liệu.");
  const data = await res.json();
  currentData = data;
  populateProvinceFilter(data);
  renderList(data);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:red;">Lỗi tải dữ liệu!</p>`;
  }
}

// 🔹 Render danh sách item
function renderList(data) {
  const selectedProvince = document.getElementById('provinceFilter')?.value || '';
  let filteredData = data;
  
  // Apply province filter - compare directly since backend ensures normalized province field
  if (selectedProvince) {
    filteredData = data.filter(d => {
      const itemProvince = (d.province || '').trim();
      return itemProvince.toLowerCase() === selectedProvince.toLowerCase();
    });
  }
  
  const container = document.getElementById("dataList");
  container.innerHTML = "";

  if (!filteredData || !filteredData.length) {
    container.innerHTML = "<p>Không có dữ liệu phù hợp.</p>";
    return;
  }

  filteredData.forEach((item) => {
    const img =
      item.images && item.images.length
        ? `/uploads/${item.images[0]}`
        : "static/img/noimg.jpg";

    let meta = "";
    if (currentType === "artifacts") {
      if (item.era) meta += `<p><b>Niên đại:</b> ${item.era}</p>`;
      if (item.museum) meta += `<p><b>Bảo tàng:</b> ${item.museum}</p>`;
      if (item.address) meta += `<p><b>Địa chỉ:</b> ${item.address}</p>`;
      if (item.address_after) meta += `<p><b>Địa chỉ mới:</b> ${item.address_after}</p>`;
    } else if (currentType === "events") {
      if (item.date) meta += `<p><b>Ngày:</b> ${item.date}</p>`;
      if (item.location) meta += `<p><b>Địa điểm:</b> ${item.location}</p>`;
      if (item.address) meta += `<p><b>Địa chỉ:</b> ${item.address}</p>`;
      if (item.address_after) meta += `<p><b>Địa chỉ mới:</b> ${item.address_after}</p>`;
    } else if (currentType === "places") {
      if (item.address) meta += `<p><b>Địa chỉ:</b> ${item.address}</p>`;
      if (item.address_after) meta += `<p><b>Địa chỉ mới:</b> ${item.address_after}</p>`;
      if (item.open_hours)
        meta += `<p><b>Giờ mở cửa:</b> ${item.open_hours}</p>`;
    }

    const card = document.createElement("div");
    card.className = "data-card";
    card.innerHTML = `
      <img src="${img}" alt="">
      <div class="info">
        <h3>${item.name || item.title}</h3>
        ${meta}
        <p>${(item.description || "").slice(0, 100)}...</p>
        <button onclick="viewDetail('${item.id}')">Xem chi tiết</button>
      </div>`;
    container.appendChild(card);
  });
}

// populate province select based on data
function populateProvinceFilter(data) {
  const sel = document.getElementById('provinceFilter');
  if (!sel) return;
  
  // Only collect provinces that are actually set in the data
  const provinces = new Set();
  const canonical = ['Cần Thơ','Vĩnh Long','Đồng Tháp','Cà Mau','An Giang','Tây Ninh'];
  
  // Add canonical provinces first
  canonical.forEach(c => provinces.add(c));
  
  // Only add provinces that are explicitly set in the data
  (data || []).forEach(d => {
    const prov = (d.province && d.province.trim()) || '';
    if (prov && canonical.includes(prov)) {
      provinces.add(prov);
    }
  });

  sel.innerHTML = '<option value="">Tất cả</option>';
  // Only show provinces that actually exist in data
  const sortedProvinces = Array.from(provinces).sort();
  sortedProvinces.forEach(p => {
    const opt = document.createElement('option'); 
    opt.value = p; 
    opt.textContent = p; 
    sel.appendChild(opt);
  });
}

// handle province change
document.addEventListener('DOMContentLoaded', () => {
  const sel = document.getElementById('provinceFilter');
  if (sel) sel.addEventListener('change', () => renderList(currentData || []));
});

// 🔹 Xem chi tiết
function viewDetail(id) {
  // Lưu tab hiện tại vào sessionStorage trước khi chuyển trang
  sessionStorage.setItem('lastListTab', currentType);
  window.location.href = `/detail.html?id=${id}`;
}

// 🔹 Chuyển tab
document.querySelectorAll(".tab-btn").forEach((btn) => {
  btn.addEventListener("click", () => {
    document
      .querySelectorAll(".tab-btn")
      .forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    currentType = btn.getAttribute("data-type");
    // Lưu tab được chọn vào sessionStorage
    sessionStorage.setItem('lastListTab', currentType);
    loadData(currentType);
  });
});

// 🔹 Tìm kiếm
document.getElementById("searchBtn").addEventListener("click", () => {
  const query = document.getElementById("searchInput").value.trim();
  if (query) loadData(currentType, query);
  else loadData(currentType);
});

// Nhấn Enter để tìm
document
  .getElementById("searchInput")
  .addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("searchBtn").click();
  });

// 🔹 Đánh dấu tab hiện tại
document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('nav a').forEach(a => {
    const link = new URL(a.href);
    if (link.pathname === window.location.pathname) {
      a.classList.add('active');
    }
  });
});

// 🔹 Tải mặc định hoặc tab đã lưu
document.addEventListener("DOMContentLoaded", () => {
  // Khôi phục tab từ sessionStorage nếu có
  const lastTab = sessionStorage.getItem('lastListTab');
  if (lastTab) {
    currentType = lastTab;
    // Highlight button tương ứng
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
      if (btn.getAttribute("data-type") === lastTab) {
        btn.classList.add("active");
      }
    });
  }
  loadData(currentType);
});

document.addEventListener("DOMContentLoaded", () => {
  const headers = document.querySelectorAll(".main-header, .admin-header");

  headers.forEach(header => {
    const icon = document.createElement("div");
    icon.className = "header-toggle-icon";
    icon.textContent = "🏛️";
    document.body.appendChild(icon);

    let hideTimeout;

    // Hiện header, ẩn icon
    function showHeader() {
      header.classList.remove("hidden");
      icon.classList.remove("visible");
    }

    // Ẩn header, hiện icon
    function hideHeader() {
      header.classList.add("hidden");
      icon.classList.add("visible");
    }

    // Khi cuộn: hiện header, ẩn icon, reset timer
    window.addEventListener("scroll", () => {
      clearTimeout(hideTimeout);
      showHeader();
      hideTimeout = setTimeout(hideHeader, 5000); // ẩn sau 5s dừng cuộn
    });

    // Khi click icon → hiện header
    icon.addEventListener("click", showHeader);

    // ✅ Ẩn header sau 5 giây kể từ khi load trang (nếu không thao tác gì)
    hideTimeout = setTimeout(hideHeader, 5000);
  });
});


document.addEventListener("DOMContentLoaded", () => {
  const headers = document.querySelectorAll(".main-header, .admin-header");

  // 👉 Nếu không phải trang index thì giữ màu nâu đậm (giống scrolled)
  const isIndex =
    window.location.pathname.endsWith("index.html") ||
    window.location.pathname === "/" ||
    window.location.pathname === "/index";

  headers.forEach(header => {
    if (!isIndex) {
      header.classList.add("scrolled");
    }
  });
});