let currentType = "artifacts";
let currentData = [];
let listSearchPreviewUrl = "";
let isSearchMode = false;

function syncTabHighlight() {
  const tabs = document.querySelectorAll(".tab-btn");
  tabs.forEach((btn) => btn.classList.remove("active"));

  if (isSearchMode) return;

  tabs.forEach((btn) => {
    if (btn.getAttribute("data-type") === currentType) {
      btn.classList.add("active");
    }
  });
}

function clearListSearchImage(statusMessage = "") {
  const imageInput = document.getElementById("searchImageInput");
  const imagePreview = document.getElementById("listSearchImagePreview");
  const imageThumb = document.getElementById("listSearchImageThumb");
  const imageName = document.getElementById("listSearchImageName");
  const status = document.getElementById("listSearchStatus");

  if (imageInput) imageInput.value = "";
  if (listSearchPreviewUrl) {
    URL.revokeObjectURL(listSearchPreviewUrl);
    listSearchPreviewUrl = "";
  }
  if (imageThumb) imageThumb.removeAttribute("src");
  if (imageName) imageName.textContent = "";
  imagePreview?.classList.remove("active");
  if (status) status.textContent = statusMessage;
}

// 🔹 Tải dữ liệu theo loại hoặc từ khóa/ảnh
async function loadData(type = "artifacts", query = "", imageFile = null) {
  const container = document.getElementById("dataList");
  container.innerHTML = "<p>Đang tải dữ liệu...</p>";
  const hasSearch = Boolean(query || imageFile);

  try {
    let data;
    if (hasSearch) {
      // Tìm kiếm: text, image, hoặc text+image
      const formData = new FormData();
      if (query) formData.append("text", query);
      if (imageFile) formData.append("image", imageFile);

      let requests = [];
      
      // Text: string match + embedding
      if (query && !imageFile) {
        requests = [
          fetch(`/api/search?q=${encodeURIComponent(query)}`),
          fetch('/search', { method: 'POST', body: formData })
        ];
      } 
      // Image only: embedding
      else if (imageFile && !query) {
        requests = [
          fetch('/search', { method: 'POST', body: formData })
        ];
      }
      // Text + Image: string + text embedding + image embedding
      else {
        const textFormData = new FormData();
        textFormData.append("text", query);
        requests = [
          fetch(`/api/search?q=${encodeURIComponent(query)}`),
          fetch('/search', { method: 'POST', body: textFormData }),
          fetch('/search', { method: 'POST', body: formData })
        ];
      }

      const results = await Promise.allSettled(requests);
      const responses = results.map(r => r.value);
      const dataArrays = await Promise.all(responses.map(async (res) => {
        if (!res || !res.ok) return [];
        try {
          const json = await res.json();
          return Array.isArray(json) ? json : [];
        } catch {
          return [];
        }
      }));

      if (query && !imageFile) {
        // Text only: merge keyword + embedding
        data = mergeSearchResults(dataArrays[0], dataArrays[1]);
      } else if (imageFile && !query) {
        // Image only
        data = dataArrays[0];
      } else {
        // Text + Image: merge all three (keyword + text embedding + image embedding)
        const merged = new Map();
        
        // Add keyword results
        (dataArrays[0] || []).forEach(item => {
          if (!item?.id) return;
          merged.set(item.id, { ...item, mode: 'keyword' });
        });
        
        // Add text embedding results
        (dataArrays[1] || []).forEach(item => {
          if (!item?.id) return;
          const existing = merged.get(item.id);
          if (!existing) {
            merged.set(item.id, { ...item, mode: 'text' });
          } else {
            merged.set(item.id, {
              ...existing,
              ...item,
              mode: existing.mode === 'keyword' ? `keyword+text` : `keyword+text`
            });
          }
        });
        
        // Add image embedding results
        (dataArrays[2] || []).forEach(item => {
          if (!item?.id) return;
          const existing = merged.get(item.id);
          if (!existing) {
            merged.set(item.id, { ...item, mode: 'image' });
          } else {
            const mode = existing.mode;
            if (mode === 'keyword' || mode === 'keyword+text') {
              merged.set(item.id, { ...existing, mode: `${mode}+image` });
            } else if (mode === 'text') {
              merged.set(item.id, { ...existing, mode: 'text+image' });
            }
          }
        });
        
        // Sort by priority
        data = Array.from(merged.values()).sort((a, b) => {
          const modePriority = (mode) => {
            if (!mode) return 0;
            if (mode.includes('keyword') && mode.includes('text') && mode.includes('image')) return 5;
            if (mode.includes('keyword') && mode.includes('text')) return 4;
            if (mode.includes('keyword')) return 3;
            if (mode.includes('text') && mode.includes('image')) return 2;
            return 1;
          };
          return modePriority(b.mode) - modePriority(a.mode);
        });
      }
    } else {
      const res = await fetch(`/api/${type}`);
      if (!res.ok) throw new Error("Không thể tải dữ liệu.");
      data = await res.json();
    }

    isSearchMode = hasSearch;
    syncTabHighlight();
    const normalized = hasSearch ? (data || []) : data;

    currentData = normalized;
    populateProvinceFilter(normalized);
    renderList(normalized);
  } catch (err) {
    console.error(err);
    container.innerHTML = `<p style="color:red;">Lỗi tải dữ liệu!</p>`;
  }
}

async function parseSearchResponse(result) {
  if (result.status !== 'fulfilled') return [];
  const res = result.value;
  if (!res.ok) return [];
  try {
    const data = await res.json();
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function mergeSearchResults(keywordItems, embeddingItems) {
  const merged = new Map();

  (keywordItems || []).forEach((item) => {
    if (!item?.id) return;
    merged.set(item.id, { ...item, mode: 'keyword' });
  });

  (embeddingItems || []).forEach((item) => {
    if (!item?.id) return;
    const existing = merged.get(item.id);
    if (!existing) {
      merged.set(item.id, item);
      return;
    }

    merged.set(item.id, {
      ...existing,
      ...item,
      mode: existing.mode === 'keyword' ? `keyword+${item.mode || 'text'}` : item.mode
    });
  });

  return Array.from(merged.values()).sort((a, b) => {
    const modePriority = (mode) => {
      if (!mode) return 0;
      if (mode === 'keyword+text') return 4;
      if (String(mode).startsWith('keyword+')) return 3;
      if (mode === 'keyword') return 2;
      return 1;
    };

    const pa = modePriority(a.mode);
    const pb = modePriority(b.mode);
    if (pa !== pb) return pb - pa;

    const sa = typeof a.score === 'number' ? a.score : -1;
    const sb = typeof b.score === 'number' ? b.score : -1;
    return sb - sa;
  });
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

    const itemType = item?.type || (currentType === "artifacts" ? "artifact" : currentType === "events" ? "event" : "place");

    let meta = "";
    if (isSearchMode) {
      const typeLabel = itemType === "artifact" ? "Cổ vật" : itemType === "event" ? "Sự kiện" : "Địa điểm";
      meta += `<p><b>Loại:</b> ${typeLabel}</p>`;
    }

    if (itemType === "artifact") {
      if (item.era) meta += `<p><b>Niên đại:</b> ${item.era}</p>`;
      if (item.museum) meta += `<p><b>Bảo tàng:</b> ${item.museum}</p>`;
      if (item.address) meta += `<p><b>Địa chỉ:</b> ${item.address}</p>`;
      if (item.address_after) meta += `<p><b>Địa chỉ mới:</b> ${item.address_after}</p>`;
    } else if (itemType === "event") {
      if (item.date) meta += `<p><b>Ngày:</b> ${item.date}</p>`;
      if (item.location) meta += `<p><b>Địa điểm:</b> ${item.location}</p>`;
      if (item.address) meta += `<p><b>Địa chỉ:</b> ${item.address}</p>`;
      if (item.address_after) meta += `<p><b>Địa chỉ mới:</b> ${item.address_after}</p>`;
    } else if (itemType === "place") {
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
    isSearchMode = false;
    currentType = btn.getAttribute("data-type");
    syncTabHighlight();
    // Lưu tab được chọn vào sessionStorage
    sessionStorage.setItem('lastListTab', currentType);
    loadData(currentType);
  });
});

// 🔹 Tìm kiếm
document.getElementById("searchBtn").addEventListener("click", () => {
  const query = document.getElementById("searchInput").value.trim();
  const imageInput = document.getElementById("searchImageInput");
  const imageFile = imageInput?.files?.[0] || null;
  
  if (query || imageFile) {
    loadData(currentType, query, imageFile);
  } else {
    loadData(currentType);
  }
});

// Nhấn Enter để tìm
document
  .getElementById("searchInput")
  .addEventListener("keypress", (e) => {
    if (e.key === "Enter") document.getElementById("searchBtn").click();
  });

const listImageInput = document.getElementById("searchImageInput");
const listImagePreview = document.getElementById("listSearchImagePreview");
const listImageThumb = document.getElementById("listSearchImageThumb");
const listImageName = document.getElementById("listSearchImageName");
const removeListImageBtn = document.getElementById("removeSearchImage");
const listSearchStatus = document.getElementById("listSearchStatus");

if (removeListImageBtn) {
  removeListImageBtn.addEventListener("click", () => {
    clearListSearchImage("Đã bỏ ảnh tìm kiếm.");
  });
}

if (listImageInput) {
  listImageInput.addEventListener("change", () => {
    const file = listImageInput.files?.[0];
    if (!file) {
      clearListSearchImage("");
      return;
    }

    if (listSearchPreviewUrl) {
      URL.revokeObjectURL(listSearchPreviewUrl);
    }
    listSearchPreviewUrl = URL.createObjectURL(file);

    if (listImageThumb) listImageThumb.src = listSearchPreviewUrl;
    if (listImageName) listImageName.textContent = file.name;
    listImagePreview?.classList.add("active");
    if (listSearchStatus) listSearchStatus.textContent = `Đã chọn ảnh: ${file.name}`;
  });
}

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
  }
  syncTabHighlight();
  loadData(currentType);
});

document.addEventListener("DOMContentLoaded", () => {
  const mainNav = document.getElementById("mainNav");
  const menuBtn = document.getElementById("navMenuBtn");
  const closeBtn = document.getElementById("navCloseBtn");
  const drawer = document.getElementById("navDrawer");

  if (!mainNav || !menuBtn || !closeBtn || !drawer) return;

  const closeMenu = () => {
    mainNav.classList.remove("open");
    menuBtn.setAttribute("aria-expanded", "false");
  };

  const openMenu = () => {
    mainNav.classList.add("open");
    menuBtn.setAttribute("aria-expanded", "true");
  };

  const isMenuOpen = () => mainNav.classList.contains("open");

  menuBtn.addEventListener("click", () => {
    if (isMenuOpen()) {
      closeMenu();
    } else {
      openMenu();
    }
  });

  closeBtn.addEventListener("click", closeMenu);

  drawer.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  document.addEventListener("click", (event) => {
    if (!isMenuOpen()) return;
    const target = event.target;
    if (!(target instanceof Node)) return;

    const clickedInsideDrawer = drawer.contains(target);
    const clickedMenuBtn = menuBtn.contains(target);

    if (!clickedInsideDrawer && !clickedMenuBtn) {
      closeMenu();
    }
  });
});

document.addEventListener("DOMContentLoaded", () => {
  const headers = document.querySelectorAll(".main-header, .admin-header");

  headers.forEach(header => {
    const icon = document.createElement("div");
    icon.className = "header-toggle-icon";
    icon.textContent = "🏛️";
    document.body.appendChild(icon);

    let hideTimeout;

    function isDrawerOpen() {
      const nav = header.querySelector(".main-nav");
      return !!(nav && nav.classList.contains("open"));
    }

    // Hiện header, ẩn icon
    function showHeader() {
      header.classList.remove("hidden");
      icon.classList.remove("visible");
    }

    // Ẩn header, hiện icon
    function hideHeader() {
      if (isDrawerOpen()) return;
      header.classList.add("hidden");
      icon.classList.add("visible");
    }

    // Khi cuộn: hiện header, ẩn icon, reset timer
    window.addEventListener("scroll", () => {
      clearTimeout(hideTimeout);
      showHeader();
      hideTimeout = setTimeout(() => {
        if (!isDrawerOpen()) hideHeader();
      }, 5000); // ẩn sau 5s dừng cuộn
    });

    // Khi click icon → hiện header
    icon.addEventListener("click", showHeader);

    // ✅ Ẩn header sau 5 giây kể từ khi load trang (nếu không thao tác gì)
    hideTimeout = setTimeout(() => {
      if (!isDrawerOpen()) hideHeader();
    }, 5000);
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