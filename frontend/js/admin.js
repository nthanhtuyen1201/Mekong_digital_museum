let currentType = "artifacts";
let adminData = []; // last fetched list for currentType (used for client-side search/filter)
// Keep per-type links state so admin can edit links for artifacts, events, places independently
const currentLinksMap = {
  artifacts: [],
  events: [],
  places: []
};
function getCurrentLinks() { return currentLinksMap[currentType] || []; }
function setCurrentLinks(arr) { currentLinksMap[currentType] = Array.isArray(arr) ? arr.slice() : []; }

// Hiển thị đúng form cho từng loại
function toggleFields() {
  document.querySelectorAll(".form-group-type").forEach(div => div.style.display = "none");
  if (currentType === "artifacts") document.getElementById("artifactFields").style.display = "block";
  if (currentType === "events") document.getElementById("eventFields").style.display = "block";
  if (currentType === "places") document.getElementById("placeFields").style.display = "block";
}

// Chuyển tab
function switchTab(type) {
  currentType = type;
  const titleMap = {
    artifacts: "Cổ vật",
    events: "Sự kiện",
    places: "Di tích"
  };
  document.getElementById("adminTitle").innerText = `Quản lý ${titleMap[type]}`;
  toggleFields();
  loadList();
}

// Tải danh sách
async function loadList() {
  const res = await fetch(`/api/admin/${currentType}`);
  const data = await res.json();
  const container = document.getElementById("adminList");
  adminData = Array.isArray(data) ? data.slice() : [];
  renderAdminList(adminData);
}

// Render admin list with optional client-side filter
function renderAdminList(list, filter) {
  const container = document.getElementById("adminList");
  container.innerHTML = '';
  if (!list || !list.length) {
    container.innerHTML = "<p>Chưa có dữ liệu.</p>";
    return;
  }
  const q = (filter || document.getElementById('adminSearch')?.value || '').trim().toLowerCase();
  const filtered = q ? list.filter(item => {
    const hay = [item.id, item.name || item.title, item.description].filter(Boolean).join(' ').toLowerCase();
    return hay.includes(q);
  }) : list;

  filtered.forEach(item => {
    const img = (item.images && item.images.length) ? `/uploads/${item.images[0]}` : 'static/img/noimg.jpg';
    const div = document.createElement('div');
    div.className = 'admin-item';
    div.innerHTML = `
      <img src="${img}" alt="">
      <div class="info">
        <h3>${item.name || item.title}</h3>
        <p>${(item.description || '').slice(0, 140)}${(item.description && item.description.length>140)?'...':''}</p>
        <div style="display:flex;gap:8px;margin-top:8px;">
          <button onclick="editItem('${item.id}')">Sửa</button>
          <button onclick="deleteItem('${item.id}')">Xóa</button>
        </div>
      </div>`;
    container.appendChild(div);
  });
}

// Load artifact/event lists into select boxes (for relations)
async function loadRelationOptions() {
  // populate artifacts and events selects
  try {
    const [artsRes, evsRes] = await Promise.all([fetch('/api/admin/artifacts'), fetch('/api/admin/events')]);
    const arts = await artsRes.json();
    const evs = await evsRes.json();
    const aSel = document.getElementById('relatedArtifactsSelect');
    const eSel = document.getElementById('relatedEventsSelect');
    if (aSel) {
      aSel.innerHTML = '';
      arts.forEach(a => {
        const opt = document.createElement('option'); opt.value = a.id; opt.textContent = `${a.id} — ${a.name || a.title}`; aSel.appendChild(opt);
      });
    }
    if (eSel) {
      eSel.innerHTML = '';
      evs.forEach(ev => {
        const opt = document.createElement('option'); opt.value = ev.id; opt.textContent = `${ev.id} — ${ev.name || ev.title}`; eSel.appendChild(opt);
      });
    }
  } catch (e) { console.error('Load relation options failed', e); }
}

function renderLinks(type) {
  const t = type || currentType;
  const container = document.getElementById(`relatedLinksList-${t}`);
  if (!container) return;
  const arr = currentLinksMap[t] || [];
  container.innerHTML = '';
  if (!arr.length) {
    container.innerHTML = '<p style="color:#888">Chưa có liên kết.</p>';
    return;
  }
  arr.forEach((lnk, idx) => {
    const row = document.createElement('div');
    row.className = 'related-link-row';
    row.innerHTML = `<div class="related-link-main"><strong class="related-link-title">${lnk.title}</strong><br><small class="related-link-url">${lnk.url}</small></div><div class="related-link-check"><input type="checkbox" data-idx="${idx}" /></div>`;
    container.appendChild(row);
  });
}

// Hiển thị form thêm/sửa
function showAddForm() {
  document.getElementById("adminFormModal").classList.remove("hidden");
  document.getElementById("adminForm").reset();
  document.getElementById("formTitle").innerText = "Thêm mới";
  toggleFields();
  // load relation options when showing form for places
  if (currentType === 'places') loadRelationOptions();
  setCurrentLinks([]);
  renderLinks(currentType);
}
function hideAddForm() {
  document.getElementById("adminFormModal").classList.add("hidden");
}

// Xử lý xem trước ảnh
function setupImagePreview() {
  const input = document.getElementById("itemImages");
  const preview = document.getElementById("imagePreview");
  input.addEventListener("change", e => {
    preview.innerHTML = "";
    [...e.target.files].forEach(file => {
      const reader = new FileReader();
      reader.onload = ev => {
        const img = document.createElement("img");
        img.src = ev.target.result;
        img.className = "preview";
        preview.appendChild(img);
      };
      reader.readAsDataURL(file);
    });
  });
}

// Xử lý xem trước video
function setupVideoPreview() {
  const input = document.getElementById("itemVideos");
  const preview = document.getElementById("videoPreview");
  if (!input || !preview) return;
  input.addEventListener("change", e => {
    preview.innerHTML = "";
    [...e.target.files].forEach(file => {
      const item = document.createElement("div");
      item.className = "media-item";
      item.innerHTML = `
        <div class="media-icon">🎬</div>
        <div class="media-name">${file.name}</div>
        <div class="media-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
      `;
      preview.appendChild(item);
    });
  });
}

// Xử lý xem trước audio
function setupAudioPreview() {
  const input = document.getElementById("itemAudios");
  const preview = document.getElementById("audioPreview");
  if (!input || !preview) return;
  input.addEventListener("change", e => {
    preview.innerHTML = "";
    [...e.target.files].forEach(file => {
      const item = document.createElement("div");
      item.className = "media-item";
      item.innerHTML = `
        <div class="media-icon">🎵</div>
        <div class="media-name">${file.name}</div>
        <div class="media-size">${(file.size / 1024 / 1024).toFixed(2)} MB</div>
      `;
      preview.appendChild(item);
    });
  });
}

// Chỉnh sửa
async function editItem(id) {
  const res = await fetch(`/api/item/${id}`);
  const item = await res.json();
  document.getElementById("adminFormModal").classList.remove("hidden");
  document.getElementById("formTitle").innerText = "Chỉnh sửa";

  document.getElementById("itemId").value = item.id;
  document.getElementById("itemName").value = item.name || item.title || "";
  document.getElementById("itemDesc").value = item.description || "";
  document.getElementById("itemLat").value = item.lat || "";
  document.getElementById("itemLng").value = item.lng || "";

  // Theo loại
  if (item.type === "artifact") {
    currentType = "artifacts";
    document.getElementById("itemEra").value = item.era || "";
    document.getElementById("itemMuseum").value = item.museum || "";
    document.getElementById("itemAddressArtifact").value = item.address || "";
    document.getElementById("itemAddressAfterArtifact").value = item.address_after || "";
  } else if (item.type === "event") {
    currentType = "events";
    document.getElementById("itemDate").value = item.date || "";
    document.getElementById("itemLocation").value = item.location || "";
    document.getElementById("itemAddressEvent").value = item.address || "";
    document.getElementById("itemAddressAfterEvent").value = item.address_after || "";
  } else if (item.type === "place") {
    currentType = "places";
    document.getElementById("itemType").value = item.type || "";
    document.getElementById("itemAddressPlace").value = item.address || "";
    document.getElementById("itemAddressAfterPlace").value = item.address_after || "";
    document.getElementById("itemOpenHours").value = item.open_hours || "";
    // populate related selects if present
    await loadRelationOptions();
    const aSel = document.getElementById('relatedArtifactsSelect');
    const eSel = document.getElementById('relatedEventsSelect');
    if (aSel && item.related_artifacts) {
      Array.from(aSel.options).forEach(o => { if (item.related_artifacts.includes(o.value)) o.selected = true; });
    }
    if (eSel && item.related_events) {
      Array.from(eSel.options).forEach(o => { if (item.related_events.includes(o.value)) o.selected = true; });
    }
  }
  // populate links for all types
  setCurrentLinks(item.links && Array.isArray(item.links) ? item.links.slice() : []);
  renderLinks(currentType);
  toggleFields();
}

// Lưu dữ liệu
const _adminFormEl = document.getElementById("adminForm");
if (_adminFormEl) {
  _adminFormEl.addEventListener("submit", async e => {
  e.preventDefault();
  
  // Set name attribute cho address fields của loại hiện tại
  const addressFields = {
    artifacts: ['itemAddressArtifact', 'itemAddressAfterArtifact'],
    events: ['itemAddressEvent', 'itemAddressAfterEvent'],
    places: ['itemAddressPlace', 'itemAddressAfterPlace']
  };
  
  // Xóa name của tất cả address fields
  Object.values(addressFields).flat().forEach(id => {
    const el = document.getElementById(id);
    if (el) el.removeAttribute('name');
  });
  
  // Chỉ set name cho address fields của loại hiện tại
  if (addressFields[currentType]) {
    addressFields[currentType].forEach(id => {
      const el = document.getElementById(id);
      if (el) {
        const fieldName = el.getAttribute('data-field');
        if (fieldName) el.setAttribute('name', fieldName);
      }
    });
  }
  
  const fd = new FormData(e.target);
  // if editing/creating a place, append related ids from selects
  if (currentType === 'places') {
    const aSel = document.getElementById('relatedArtifactsSelect');
    const eSel = document.getElementById('relatedEventsSelect');
    if (aSel) {
      const vals = Array.from(aSel.selectedOptions).map(o => o.value);
      if (vals.length) fd.set('related_artifacts', vals.join(','));
    }
    if (eSel) {
      const vals = Array.from(eSel.selectedOptions).map(o => o.value);
      if (vals.length) fd.set('related_events', vals.join(','));
    }
  }
  // always append links for the current type (if any)
  const linksToSend = getCurrentLinks();
  if (linksToSend && linksToSend.length) fd.set('links', JSON.stringify(linksToSend));
  const id = document.getElementById("itemId").value;
  const method = id ? "PUT" : "POST";
  const url = id
    ? `/api/admin/${currentType}/${id}`
    : `/api/admin/${currentType}`;
  const res = await fetch(url, { method, body: fd });
  if (res.ok) {
    alert("Lưu thành công!");
    hideAddForm();
    loadList();
  } else {
    alert("Lỗi khi lưu!");
  }
  });
} else {
  console.warn('admin.js: #adminForm not found on page');
}

// Xóa
async function deleteItem(id) {
  if (!confirm("Xóa mục này?")) return;
  await fetch(`/api/admin/${currentType}/${id}`, { method: "DELETE" });
  loadList();
}

// Đăng xuất
const _logoutBtn = document.getElementById("logoutBtn");
if (_logoutBtn) {
  _logoutBtn.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/login.html";
  });
} else {
  console.warn('admin.js: #logoutBtn not found on page');
}

// Kiểm tra đăng nhập
async function checkAuth() {
  const res = await fetch("/api/check_login");
  const data = await res.json();
  if (!data.logged_in) window.location.href = "/login.html";
  else {
    toggleFields();
    loadList();
    setupImagePreview();
    setupVideoPreview();
    setupAudioPreview();
  }
}
document.addEventListener("DOMContentLoaded", checkAuth);

// relation add/remove button handlers
document.addEventListener('DOMContentLoaded', () => {
  const addArtBtn = document.getElementById('addRelatedArtifactBtn');
  const remArtBtn = document.getElementById('removeRelatedArtifactBtn');
  const addEvBtn = document.getElementById('addRelatedEventBtn');
  const remEvBtn = document.getElementById('removeRelatedEventBtn');

  if (addArtBtn) addArtBtn.addEventListener('click', () => {
    const input = document.getElementById('relatedArtifactsInput');
    const sel = document.getElementById('relatedArtifactsSelect');
    if (input && sel && input.value.trim()) {
      const v = input.value.trim();
      if (![...sel.options].some(o => o.value === v)) {
        const opt = document.createElement('option'); opt.value = v; opt.textContent = v; opt.selected = true; sel.appendChild(opt);
      } else {
        [...sel.options].forEach(o=>{ if (o.value===v) o.selected=true });
      }
      input.value = '';
    }
  });

  if (remArtBtn) remArtBtn.addEventListener('click', () => {
    const sel = document.getElementById('relatedArtifactsSelect');
    if (!sel) return;
    Array.from(sel.selectedOptions).forEach(o => o.remove());
  });

  if (addEvBtn) addEvBtn.addEventListener('click', () => {
    const input = document.getElementById('relatedEventsInput');
    const sel = document.getElementById('relatedEventsSelect');
    if (input && sel && input.value.trim()) {
      const v = input.value.trim();
      if (![...sel.options].some(o => o.value === v)) {
        const opt = document.createElement('option'); opt.value = v; opt.textContent = v; opt.selected = true; sel.appendChild(opt);
      } else {
        [...sel.options].forEach(o=>{ if (o.value===v) o.selected=true });
      }
      input.value = '';
    }
  });

  if (remEvBtn) remEvBtn.addEventListener('click', () => {
    const sel = document.getElementById('relatedEventsSelect');
    if (!sel) return;
    Array.from(sel.selectedOptions).forEach(o => o.remove());
  });

  // links add/remove handlers for each type (artifacts, events, places)
  ['artifacts','events','places'].forEach(t => {
    const addBtn = document.getElementById(`addLinkBtn-${t}`);
    const remBtn = document.getElementById(`removeLinkBtn-${t}`);
    const titleInput = document.getElementById(`linkTitleInput-${t}`);
    const urlInput = document.getElementById(`linkUrlInput-${t}`);
    const containerId = `relatedLinksList-${t}`;
    if (addBtn) addBtn.addEventListener('click', () => {
      if (!titleInput || !urlInput) return;
      const title = titleInput.value.trim();
      const url = urlInput.value.trim();
      if (!title || !url) { alert('Vui lòng nhập cả tiêu đề và URL'); return; }
      currentLinksMap[t] = currentLinksMap[t] || [];
      currentLinksMap[t].push({ title, url });
      titleInput.value = '';
      urlInput.value = '';
      renderLinks(t);
    });
    if (remBtn) remBtn.addEventListener('click', () => {
      const container = document.getElementById(containerId);
      if (!container) return;
      const boxes = Array.from(container.querySelectorAll('input[type=checkbox]'));
      const idxs = boxes.filter(b => b.checked).map(b => parseInt(b.dataset.idx));
      if (!idxs.length) { alert('Chọn ít nhất một liên kết để xóa'); return; }
      currentLinksMap[t] = (currentLinksMap[t] || []).filter((_, i) => !idxs.includes(i));
      renderLinks(t);
    });
  });
  // admin search input: debounce filter on input
  const searchInput = document.getElementById('adminSearch');
  if (searchInput) {
    let t = null;
    searchInput.addEventListener('input', () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => renderAdminList(adminData, searchInput.value), 200);
    });
  }
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

// =========================================
// 👥 QUẢN LÝ ADMIN
// =========================================

let currentAdminUsername = null; // lưu username của admin hiện tại

// Mở modal quản lý admin
async function openAdminManager() {
  const modal = document.getElementById('adminManagerModal');
  if (modal) {
    modal.classList.remove('hidden');
    await loadAdminUsers();
    // Lấy username hiện tại
    try {
      const res = await fetch('/api/current_user');
      if (res.ok) {
        const user = await res.json();
        currentAdminUsername = user.username;
      }
    } catch (e) {
      console.error('Error getting current user:', e);
    }
  }
}

// Đóng modal
function closeAdminManager() {
  const modal = document.getElementById('adminManagerModal');
  if (modal) modal.classList.add('hidden');
}

// Tải danh sách admin
async function loadAdminUsers() {
  try {
    const res = await fetch('/api/admin/users');
    if (!res.ok) {
      alert('Không thể tải danh sách admin');
      return;
    }
    const admins = await res.json();
    renderAdminUsers(admins);
  } catch (e) {
    console.error('Error loading admin users:', e);
    alert('Lỗi khi tải danh sách admin');
  }
}

// Hiển thị danh sách admin
function renderAdminUsers(admins) {
  const container = document.getElementById('adminUsersList');
  if (!container) return;
  
  if (!admins || admins.length === 0) {
    container.innerHTML = '<p>Chưa có admin nào.</p>';
    return;
  }
  
  container.innerHTML = admins.map(admin => {
    const isCurrentUser = currentAdminUsername && admin.username === currentAdminUsername;
    return `
    <div style="display: flex; align-items: center; justify-content: space-between; padding: 12px; background: ${isCurrentUser ? '#e8f5e9' : '#f9f9f9'}; border-radius: 6px; margin-bottom: 10px; ${isCurrentUser ? 'border: 2px solid #4caf50;' : ''}">
      <div>
        <strong style="font-size: 16px;">${admin.username}</strong>
        ${isCurrentUser ? '<span style="color: #4caf50; margin-left: 8px; font-weight: bold;">(Bạn)</span>' : ''}
        <div style="font-size: 12px; color: #666; margin-top: 4px;">
          Tạo: ${admin.created_at ? new Date(admin.created_at).toLocaleString('vi-VN') : 'N/A'}
          ${admin.created_by ? ` bởi ${admin.created_by}` : ''}
        </div>
      </div>
      ${!isCurrentUser ? `
      <button onclick="deleteAdmin('${admin.username}')" 
        style="padding: 6px 12px; background: #d32f2f; color: white; border: none; cursor: pointer; border-radius: 4px;">
        🗑️ Xóa
      </button>
      ` : '<span style="color: #999; font-size: 12px;">Không thể xóa</span>'}
    </div>
  `;
  }).join('');
}

// Tạo admin mới
const createAdminFormEl = document.getElementById('createAdminForm');
if (createAdminFormEl) {
  createAdminFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('newAdminUsername').value.trim();
    const password = document.getElementById('newAdminPassword').value.trim();
    
    if (!username || !password) {
      alert('Vui lòng nhập đầy đủ username và password');
      return;
    }
    
    if (password.length < 5) {
      alert('Mật khẩu phải có ít nhất 5 ký tự');
      return;
    }
    
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({username, password})
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message || 'Tạo admin thành công!');
        document.getElementById('newAdminUsername').value = '';
        document.getElementById('newAdminPassword').value = '';
        await loadAdminUsers();
      } else {
        alert(data.error || 'Lỗi khi tạo admin');
      }
    } catch (e) {
      console.error('Error creating admin:', e);
      alert('Lỗi khi tạo admin');
    }
  });
}

// Xóa admin
async function deleteAdmin(username) {
  if (!confirm(`Bạn có chắc muốn xóa admin "${username}"?`)) return;
  
  try {
    const res = await fetch(`/api/admin/users/${username}`, {
      method: 'DELETE'
    });
    
    const data = await res.json();
    
    if (res.ok) {
      alert(data.message || 'Xóa admin thành công!');
      await loadAdminUsers();
    } else {
      alert(data.error || 'Lỗi khi xóa admin');
    }
  } catch (e) {
    console.error('Error deleting admin:', e);
    alert('Lỗi khi xóa admin');
  }
}

// Đổi mật khẩu
const changePasswordFormEl = document.getElementById('changePasswordForm');
if (changePasswordFormEl) {
  changePasswordFormEl.addEventListener('submit', async (e) => {
    e.preventDefault();
    const oldPassword = document.getElementById('oldPassword').value.trim();
    const newPassword = document.getElementById('newPassword').value.trim();
    
    if (!oldPassword || !newPassword) {
      alert('Vui lòng nhập đầy đủ mật khẩu cũ và mới');
      return;
    }
    
    if (newPassword.length < 5) {
      alert('Mật khẩu mới phải có ít nhất 5 ký tự');
      return;
    }
    
    if (!currentAdminUsername) {
      alert('Không xác định được username hiện tại');
      return;
    }
    
    try {
      const res = await fetch(`/api/admin/users/${currentAdminUsername}/password`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({old_password: oldPassword, new_password: newPassword})
      });
      
      const data = await res.json();
      
      if (res.ok) {
        alert(data.message || 'Đổi mật khẩu thành công!');
        document.getElementById('oldPassword').value = '';
        document.getElementById('newPassword').value = '';
      } else {
        alert(data.error || 'Lỗi khi đổi mật khẩu');
      }
    } catch (e) {
      console.error('Error changing password:', e);
      alert('Lỗi khi đổi mật khẩu');
    }
  });
}