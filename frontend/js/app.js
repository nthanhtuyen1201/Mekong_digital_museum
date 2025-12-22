// =========================================
// 🖼️ HERO SLIDER — TỰ ĐỘNG CHUYỂN ẢNH
// =========================================
let currentSlide = 0;
const slides = document.querySelectorAll(".hero-slider .slide");
const videoSlide = document.querySelector(".hero-video video");
const muteBtn = document.getElementById("muteToggleBtn");

let slideInterval;
let isMuted = true;

// 👉 Hiển thị slide theo chỉ số
function showSlide(index) {
  slides.forEach((s, i) => s.classList.toggle("active", i === index));
}

// 👉 Chuyển sang slide kế
function nextSlide() {
  currentSlide = (currentSlide + 1) % slides.length;
  showSlide(currentSlide);

  // Nếu quay lại slide video
  if (slides[currentSlide].classList.contains("hero-video")) {
    handleVideoSlide();
  }
}

// 👉 Bắt đầu auto slide bình thường (5 giây)
function startAutoSlide() {
  clearInterval(slideInterval);
  slideInterval = setInterval(() => {
    nextSlide();
  }, 5000);
}

// 👉 Dừng auto slide
function stopAutoSlide() {
  clearInterval(slideInterval);
}

// 👉 Khi đến slide video thì dừng auto slide và phát lại video
function handleVideoSlide() {
  stopAutoSlide();
  if (!videoSlide) return;

  videoSlide.currentTime = 0;
  videoSlide.muted = isMuted;
  videoSlide.play();

  videoSlide.onended = () => {
    nextSlide();
    startAutoSlide();
  };
}

// 👉 Khởi động
if (videoSlide) {
  showSlide(0);
  handleVideoSlide(); // phát video ngay đầu
} else {
  startAutoSlide();
}

// 🎵 Nút bật/tắt âm thanh video
if (muteBtn && videoSlide) {
  muteBtn.addEventListener("click", () => {
    isMuted = !isMuted;
    videoSlide.muted = isMuted;
    muteBtn.textContent = isMuted ? "🔇" : "🔊";
  });
}

// 👉 Cuộn trang mượt đến phần theo id
function scrollToSection(id) {
  const el = document.getElementById(id);
  if (el) window.scrollTo({ top: el.offsetTop - 80, behavior: "smooth" });
}


// =========================================
// 🔍 TÌM KIẾM — GỌI API VÀ HIỂN THỊ KẾT QUẢ
// =========================================
async function handleSearch(e) {
  // Chỉ chạy khi nhấn Enter
  if (e.key !== 'Enter') return;

  const query = e.target.value.trim();
  if (!query) return;

  // Gọi API tìm kiếm
  const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
  const data = await res.json();

  // Render kết quả ra giao diện
  renderSearchResults(data);
}

// 👉 Hiển thị danh sách kết quả tìm kiếm
function renderSearchResults(items) {
  const container = document.getElementById('searchResults');
  container.innerHTML = '';

  if (!items || !items.length) {
    container.innerHTML = '<p>Không tìm thấy kết quả.</p>';
    return;
  }

  // Duyệt qua từng kết quả để tạo thẻ hiển thị
  items.forEach(item => {
    const card = document.createElement('div');
    card.className = 'search-card';

    const imgUrl = getImageUrl(item);
    const typeLabel = {
      event: 'Sự kiện',
      place: 'Di tích',
      artifact: 'Cổ vật'
    }[item.type] || 'Khác';

    card.innerHTML = `
      <img src="${imgUrl}" alt="">
      <div class="info">
        <h3>${item.name || item.title}</h3>
        <p>${typeLabel}</p>
        <button onclick="openDetail('${item.id}')">Xem chi tiết</button>
      </div>
    `;
    container.appendChild(card);
  });
}

// =========================================
// 🖼️ XỬ LÝ ĐƯỜNG DẪN ẢNH — DÙNG CHUNG
// =========================================
function getImageUrl(item) {
  if (item.images && item.images.length) return `/uploads/${item.images[0]}`;
  if (item.image) return `/${item.image}`;
  return 'static/img/noimg.jpg'; // ảnh mặc định khi không có
}

// =========================================
// 🏺 HIỂN THỊ MẪU 6 CỔ VẬT TRÊN TRANG CHỦ
// =========================================
// 🏺 HIỂN THỊ MẪU 6 CỔ VẬT TRÊN TRANG CHỦ
async function loadArtifactsPreview() {
  const res = await fetch('/api/artifacts');
  const data = await res.json();

  const grid = document.getElementById('artifactGrid');
  grid.innerHTML = '';

  if (!data || !data.length) {
    grid.innerHTML = '<p style="color: #6B5E4B; text-align: center; width: 100%;">Không có hiện vật nào.</p>';
    return;
  }

  // Hiển thị 6 cổ vật đầu tiên
  data.slice(0, 6).forEach(item => {
    const imgUrl = getImageUrl(item);
    const card = document.createElement('div');
    card.className = 'artifact-card';

    card.innerHTML = `
      <img src="${imgUrl}" alt="${item.name}">
      <div class="info">
        <h3>${item.name}</h3>
        <p class="clamp-4">${item.description ? item.description.substring(0, 120) + '...' : 'Không có mô tả'}</p>
        <button onclick="openDetail('${item.id}')">Xem chi tiết</button>
      </div>
    `;
    grid.appendChild(card);
  });
}

// 👉 Mở trang chi tiết theo id
function openDetail(id) {
  window.location.href = `/detail.html?id=${id}`;
}

// =========================================
// 🗺️ BẢN ĐỒ — HIỂN THỊ ĐỊA ĐIỂM / CỔ VẬT / SỰ KIỆN
// =========================================
let map;
let markers = { places: [], artifacts: [], events: [] };
let markerCluster;
let rawData = { places: [], artifacts: [], events: [] };

// Normalize province names to post-merge Mekong-Delta units
function extractProvinceFromText(text) {
  if (!text) return '';
  const parts = text.split(',').map(s => s.trim()).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

function normalizeProvinceName(name) {
  if (!name) return '';
  let s = String(name).toLowerCase().replace(/\b(tỉnh|thành phố|thanh pho|tp\.?|tp)\b/gi, '').trim();
  // mapping old provinces into 6 post-merge units
  const mapping = [
    { re: /^(can ?tho|cantho|cần thơ)$/i, to: 'Cần Thơ' },
    { re: /^(soc ?trang|soctrang|sóc trăng)$/i, to: 'Cần Thơ' },
    { re: /^(hau ?giang|haugia|hậu giang)$/i, to: 'Cần Thơ' },

    { re: /^(vinh ?long|vinhlong|vĩnh long)$/i, to: 'Vĩnh Long' },
    { re: /^(ben ?tre|bentre|bến tre)$/i, to: 'Vĩnh Long' },
    { re: /^(tra ?vinh|travinh|trà vinh)$/i, to: 'Vĩnh Long' },

    { re: /^(tien ?giang|tiengiang|tiền giang)$/i, to: 'Đồng Tháp' },
    { re: /^(dong ?thap|dongthap|đồng tháp)$/i, to: 'Đồng Tháp' },

    { re: /^(ca ?mau|camau|cà mau)$/i, to: 'Cà Mau' },
    { re: /^(bac ?lieu|baclieu|bạc liêu)$/i, to: 'Cà Mau' },

    { re: /^(an ?giang|angiang)$/i, to: 'An Giang' },
    { re: /^(kien ?giang|kiengiang|kiên giang)$/i, to: 'An Giang' },

    { re: /^(long ?an|longan|long an)$/i, to: 'Tây Ninh' },
    { re: /^(tay ?ninh|tay ninh|tayninh)$/i, to: 'Tây Ninh' }
  ];

  for (const m of mapping) {
    if (m.re.test(s)) return m.to;
  }
  return '';
}

// 👉 Khởi tạo bản đồ Leaflet + tải plugin cluster
async function loadAllMapMarkers() {
  if (!window.L || !document.getElementById('main-map')) return;

  map = L.map('main-map').setView([10.2, 105.7], 7);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 18,
    attribution: '© OpenStreetMap contributors'
  }).addTo(map);

  // Nạp JS & CSS cho MarkerCluster
  const script = document.createElement('script');
  script.src = 'https://unpkg.com/leaflet.markercluster@1.5.3/dist/leaflet.markercluster.js';
  script.onload = initializeMarkers;
  document.head.appendChild(script);

  ['MarkerCluster.css', 'MarkerCluster.Default.css'].forEach(file => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = `https://unpkg.com/leaflet.markercluster@1.5.3/dist/${file}`;
    document.head.appendChild(link);
  });
}

// 👉 Khởi tạo nhóm marker khi đã load xong plugin
async function initializeMarkers() {
  markerCluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50 });

  // Nạp các loại marker (địa điểm, cổ vật, sự kiện)
  await Promise.all([
    loadPlaceMarkers(),
    loadArtifactMarkers(),
    loadEventMarkers()
  ]);

  showFilteredMarkers('all');
  setupFilterButtons();
  populateMapProvinceFilter();
}

function populateMapProvinceFilter() {
  const sel = document.getElementById('mapProvinceFilter');
  if (!sel) return;
  
  const provinces = new Set();
  const canonical = ['Cần Thơ','Vĩnh Long','Đồng Tháp','Cà Mau','An Giang','Tây Ninh'];
  
  // Add canonical provinces
  canonical.forEach(c => provinces.add(c));
  
  // Only collect provinces that are explicitly set in data (don't add junk)
  ['places', 'artifacts', 'events'].forEach(k => {
    (rawData[k] || []).forEach(i => {
      const prov = (i.province && i.province.trim()) || '';
      // Only add if it's in the canonical list
      if (prov && canonical.includes(prov)) {
        provinces.add(prov);
      }
    });
  });
  
  sel.innerHTML = '<option value="">Tất cả</option>';
  // Show only valid provinces in canonical order
  canonical.forEach(c => {
    if (provinces.has(c)) {
      const opt = document.createElement('option'); 
      opt.value = c; 
      opt.textContent = c; 
      sel.appendChild(opt);
    }
  });
  
  sel.addEventListener('change', () => {
    // refresh markers using currently active type button
    const active = document.querySelector('.filter-btn.active');
    const type = active ? active.getAttribute('data-type') : 'all';
    showFilteredMarkers(type || 'all');
  });

  // wire search controls
  const searchBtn = document.getElementById('mapSearchBtn');
  const clearBtn = document.getElementById('mapClearBtn');
  const input = document.getElementById('mapSearchInput');
  if (searchBtn) searchBtn.addEventListener('click', () => {
    const active = document.querySelector('.filter-btn.active');
    const type = active ? active.getAttribute('data-type') : 'all';
    showFilteredMarkers(type || 'all');
  });
  if (clearBtn) clearBtn.addEventListener('click', () => {
    if (input) input.value = '';
    if (sel) sel.value = '';
    const active = document.querySelector('.filter-btn.active');
    const type = active ? active.getAttribute('data-type') : 'all';
    showFilteredMarkers(type || 'all');
  });
  if (input) input.addEventListener('keypress', (e) => { if (e.key === 'Enter') { searchBtn?.click(); } });
}

// -------------------------
// 🏛️ Địa điểm lịch sử
// -------------------------
async function loadPlaceMarkers() {
  const res = await fetch('/api/places');
  const places = await res.json();
  // Use province directly from backend (already normalized via derive_province)
  rawData.places = (places || []).map(p => ({
    ...p,
    province: p.province || '' // backend already set this via derive_province
  }));
  rawData.places.forEach(pl => {
    if (pl.lat && pl.lng) {
      const popup = `
        <div class="map-popup">
          <h3>${pl.name}</h3>
          <p><strong>Tỉnh (sau sáp nhập):</strong> ${pl.province || ''}</p>
          ${pl.era ? `<p><strong>Thời kỳ:</strong> ${pl.era}</p>` : ''}
          ${pl.description ? `<p>${pl.description.slice(0, 100)}...</p>` : ''}
          <button onclick="openDetail('${pl.id}')" class="popup-btn">Xem chi tiết</button>
        </div>`;
      markers.places.push(L.marker([pl.lat, pl.lng]).bindPopup(popup));
    }
  });
}

// -------------------------
// 🏺 Cổ vật (icon vàng)
// -------------------------
async function loadArtifactMarkers() {
  const res = await fetch('/api/artifacts');
  const artifacts = await res.json();
  // Use province directly from backend (already normalized via derive_province)
  rawData.artifacts = (artifacts || []).map(a => ({
    ...a,
    province: a.province || '' // backend already set this via derive_province
  }));

  const artifactIcon = new L.Icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-yellow.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  });

  rawData.artifacts.forEach(art => {
    if (art.lat && art.lng) {
      const popup = `
        <div class="map-popup">
          <h3>${art.name}</h3>
          ${art.era ? `<p><strong>Thời kỳ:</strong> ${art.era}</p>` : ''}
          ${art.museum ? `<p><strong>Bảo tàng:</strong> ${art.museum}</p>` : ''}
          ${art.description ? `<p>${art.description.slice(0, 100)}...</p>` : ''}
          <button onclick="openDetail('${art.id}')" class="popup-btn" style="background:#f39c12;">Xem chi tiết</button>
        </div>`;
      markers.artifacts.push(L.marker([art.lat, art.lng], { icon: artifactIcon }).bindPopup(popup));
    }
  });
}

// -------------------------
// 🚩 Sự kiện lịch sử (icon cờ đỏ)
// -------------------------
async function loadEventMarkers() {
  const res = await fetch('/api/events');
  const events = await res.json();
  // Use province directly from backend (already normalized via derive_province)
  rawData.events = (events || []).map(e => ({
    ...e,
    province: e.province || '' // backend already set this via derive_province
  }));

  const eventIcon = L.icon({
    iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
    iconSize: [30, 30],
    iconAnchor: [15, 30],
    popupAnchor: [0, -30]
  });

  rawData.events.forEach(ev => {
    if (ev.lat && ev.lng) {
      const popup = `
        <div class="map-popup">
          <h3 style="color:#e74c3c;">${ev.name}</h3>
          <p><strong>Thời gian:</strong> ${ev.date || ''}</p>
          <p><strong>Địa điểm:</strong> ${ev.location || ''}</p>
          <button onclick="openDetail('${ev.id}')" class="popup-btn" style="background:#e74c3c;">Xem chi tiết</button>
        </div>`;
      markers.events.push(L.marker([ev.lat, ev.lng], { icon: eventIcon }).bindPopup(popup));
    }
  });
}

// 👉 Hiển thị marker theo loại (lọc)
function showFilteredMarkers(filterType) {
  const selectedProvince = document.getElementById('mapProvinceFilter')?.value || '';
  const textFilter = (document.getElementById('mapSearchInput')?.value || '').trim().toLowerCase();
  if (markerCluster) map.removeLayer(markerCluster);

  markerCluster = L.markerClusterGroup({ chunkedLoading: true, maxClusterRadius: 50 });

  let visibleMarkers = [];
  let count = 0;

  const addMarkers = (list, rawList) => {
    // list: prebuilt markers array parallel to rawList
    list.forEach((marker, idx) => {
      const item = rawList && rawList[idx];
      if (selectedProvince && item) {
        if ((item.province || '').toLowerCase() !== selectedProvince.toLowerCase()) return;
      }
      if (textFilter && item) {
        const hay = [item.name, item.location, item.description, item.era, item.museum, item.title].filter(Boolean).join(' ').toLowerCase();
        if (!hay.includes(textFilter)) return;
      }
      markerCluster.addLayer(marker);
      visibleMarkers.push(marker);
    });
    // count only visible (approx)
    count = visibleMarkers.length;
  };

  if (filterType === 'all' || filterType === 'places') addMarkers(markers.places, rawData.places);
  if (filterType === 'all' || filterType === 'artifacts') addMarkers(markers.artifacts, rawData.artifacts);
  if (filterType === 'all' || filterType === 'events') addMarkers(markers.events, rawData.events);

  map.addLayer(markerCluster);
  document.getElementById('mapCounter').textContent = `Hiển thị: ${count} địa điểm`;

  if (visibleMarkers.length) {
    const group = new L.featureGroup(visibleMarkers);
    map.fitBounds(group.getBounds().pad(0.1));
  } else {
      // Nếu chưa có marker nào thì tự set về vùng Tây Nam Bộ
      map.setView([9.8, 105.1], 8); // trung tâm Hậu Giang - zoom vừa
  }
}

// 👉 Gán sự kiện click cho các nút lọc
function setupFilterButtons() {
  const buttons = document.querySelectorAll('.filter-btn');

  buttons.forEach(btn => {
    btn.addEventListener('click', function() {
      buttons.forEach(b => b.classList.remove('active'));
      this.classList.add('active');
      const type = this.getAttribute('data-type');
      showFilteredMarkers(type);
    });
  });
}

// =========================================
// 📋 DANH SÁCH DÒNG THỜI GIAN (ẨN BỚT + XEM THÊM)
// =========================================
async function loadTimelineList() {
  const container = document.getElementById("timeline-container");
  if (!container) return;
  container.innerHTML = "<p>Đang tải dữ liệu...</p>";

  try {
    const res = await fetch("/api/events");
    if (!res.ok) throw new Error("Không thể tải dữ liệu.");
    const data = await res.json();
    renderTimelineList(data);
  } catch (err) {
    console.error(err);
    container.innerHTML = "<p style='color:red;'>Lỗi tải dữ liệu!</p>";
  }
}

function renderTimelineList(data) {
  const container = document.getElementById("timeline-container");
  container.innerHTML = "";

  if (!data || !data.length) {
    container.innerHTML = "<p>Không có sự kiện nào.</p>";
    return;
  }

  // Sắp xếp theo ngày tăng dần
  data.sort((a, b) => new Date(a.date) - new Date(b.date));

  const limit = 2; // chỉ hiện 2 sự kiện đầu
  let expanded = false;

  function renderView() {
    container.innerHTML = "";
    const items = expanded ? data : data.slice(0, limit);

    items.forEach(ev => {
      // Tạo 1 wrapper chứa chấm + ngày + card
      const wrapper = document.createElement("div");
      wrapper.className = "timeline-item-wrapper";

      const dateText = ev.date || "Không rõ ngày";

      // Chấm + ngày nằm riêng (trục giữa)
      wrapper.innerHTML = `
        <div class="timeline-date">${dateText}</div>
        <div class="timeline-dot"></div>
        <div class="timeline-card">
          <img src="${getImageUrl(ev)}" alt="" class="timeline-thumb" />
          <h3>${ev.name}</h3>
          <p class="clamp-2">${ev.description || ""}</p>
          <button onclick="window.location.href='/detail.html?id=${ev.id}'">Xem chi tiết</button>
        </div>
      `;

      container.appendChild(wrapper);
    });

    // nút xem thêm / thu gọn
    if (data.length > limit) {
      const toggleBtn = document.createElement("button");
      toggleBtn.className = "timeline-toggle-btn";
      toggleBtn.innerText = expanded ? "Thu gọn" : "Xem thêm";
      toggleBtn.onclick = () => {
        expanded = !expanded;
        renderView();
      };
      container.appendChild(toggleBtn);
    }
  }

  renderView();
}



// Vis.js Timeline
let timeline;
let timelineData;

async function initTimeline() {
    const eventsRes = await fetch('/api/events');
    const events = await eventsRes.json();
    
    if (!events || !events.length) {
        document.getElementById('vis-timeline').innerHTML = '<p style="text-align: center; color: #888; padding: 50px;">Không có dữ liệu sự kiện.</p>';
        return;
    }

    // Tạo dataset cho timeline
    timelineData = new vis.DataSet();
    
    events.forEach((event, index) => {
        if (event.date) {
            timelineData.add({
                id: event.id,
                content: `<div class="timeline-event" onclick="openDetail('${event.id}')">
                            <strong>${event.name}</strong>
                            ${event.date ? `<br><small>${event.date}</small>` : ''}
                          </div>`,
                start: event.date,
                title: `${event.name}\n${event.date || ''}\n${event.description || ''}`,
                className: `event-type-${event.type || 'event'}`
            });
        }
    });

    // Tạo container
    const container = document.getElementById('vis-timeline');
    
    // Cấu hình options
    const options = {
        width: '100%',
        height: '400px',
        locale: 'vi',
        showCurrentTime: true,
        zoomMin: 1000 * 60 * 60 * 24 * 30, // 1 month
        zoomMax: 1000 * 60 * 60 * 24 * 365 * 1000, // 1000 years
        orientation: {
            axis: 'top',
            item: 'top'
        },
        format: {
            minorLabels: {
                minute: 'HH:mm',
                hour: 'HH:mm',
                weekday: 'ddd D',
                day: 'D',
                month: 'MMM',
                year: 'YYYY'
            },
            majorLabels: {
                minute: 'ddd D MMM',
                hour: 'ddd D MMM',
                weekday: 'MMMM YYYY',
                day: 'MMMM YYYY',
                month: 'YYYY',
                year: ''
            }
        },
        tooltip: {
            followMouse: true,
            overflowMethod: 'cap'
        },
        margin: {
            item: 10,
            axis: 5
        }
    };

    // Khởi tạo timeline
    timeline = new vis.Timeline(container, timelineData, options);
    
    // Cập nhật counter
    updateTimelineCounter(events.length);
    
    // Setup filter buttons
    setupTimelineFilters();
    
    // Event listeners
    timeline.on('select', function(properties) {
        if (properties.items && properties.items.length > 0) {
            const eventId = properties.items[0];
            openDetail(eventId);
        }
    });
    
    // Double click để fit timeline
    timeline.on('doubleClick', function() {
        timeline.fit();
    });
}

function setupTimelineFilters() {
    const filterButtons = document.querySelectorAll('[data-timeline-filter]');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', function() {
            // Remove active class từ tất cả buttons
            filterButtons.forEach(btn => btn.classList.remove('active'));
            
            // Add active class cho button được click
            this.classList.add('active');
            
            const filterType = this.getAttribute('data-timeline-filter');
            applyTimelineFilter(filterType);
        });
    });
}

function applyTimelineFilter(filterType) {
    if (!timeline) return;
    
    switch(filterType) {
        case 'century':
            timeline.setWindow('1900-01-01', '2100-01-01');
            break;
        case 'decade':
            const now = new Date();
            const startDecade = new Date(now.getFullYear() - 50, 0, 1);
            const endDecade = new Date(now.getFullYear() + 10, 0, 1);
            timeline.setWindow(startDecade, endDecade);
            break;
        case 'year':
            const currentYear = new Date().getFullYear();
            timeline.setWindow(`${currentYear-10}-01-01`, `${currentYear+2}-01-01`);
            break;
        case 'all':
        default:
            timeline.fit();
            break;
    }
}

function updateTimelineCounter(count) {
    document.getElementById('timelineCounter').textContent = `Hiển thị: ${count} sự kiện`;
}

// 👇 Thêm hiệu ứng cuộn xuất hiện
function initScrollAnimations() {
  const elements = document.querySelectorAll('.section, .search-section, .timeline-card');
  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) entry.target.classList.add('visible');
    });
  }, { threshold: 0.15 });

  elements.forEach(el => {
    el.classList.add('fade-in-up');
    observer.observe(el);
  });
}

// 🎵 Nút bật/tắt âm thanh cho video hero
// 🎵 Nút bật/tắt âm thanh cho video hero
document.addEventListener("DOMContentLoaded", () => {
  const video = document.getElementById("heroVideo");
  const btn = document.getElementById("muteToggleBtn");
  if (!video || !btn) return;

  let isMuted = true;
  video.muted = true;

  btn.addEventListener("click", () => {
    isMuted = !isMuted;
    video.muted = isMuted;
    btn.textContent = isMuted ? "🔇" : "🔊";
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

// Giữ hiệu ứng header đổi nền khi cuộn
window.addEventListener("scroll", () => {
  const header = document.querySelector(".main-header");
  if (!header) return;
  header.classList.toggle("scrolled", window.scrollY > 80);
});



// === Toggle qua lại giữa timeline ngang và dọc ===
const toggleBtn = document.getElementById("toggleTimelineView");
const toggleIcon = document.getElementById("toggleIcon");

const visTimeline = document.querySelector(".vis-bg-full");
const verticalTimeline = document.querySelector(".timeline-list-frame");
const timelineControls = document.querySelector(".timeline-controls"); // thanh filter

let showingHorizontal = true; // mặc định timeline ngang

toggleBtn.addEventListener("click", () => {
  if (showingHorizontal) {
    visTimeline.style.display = "none";
    verticalTimeline.style.display = "block";
    timelineControls.style.display = "none"; // 🔹 ẩn filter
    toggleIcon.textContent = "↩";
  } else {
    visTimeline.style.display = "block";
    verticalTimeline.style.display = "none";
    timelineControls.style.display = "flex"; // 🔹 hiện lại filter
    toggleIcon.textContent = "➜";
  }
  showingHorizontal = !showingHorizontal;
});

// Ẩn timeline dọc và giữ filter hiển thị lúc đầu
verticalTimeline.style.display = "none";
timelineControls.style.display = "flex";


document.querySelectorAll("#search-hints button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.getElementById("searchInput").value = btn.textContent;
    // Giả sử hàm tìm kiếm hiện tại là loadData hoặc searchData
    loadData("all", btn.textContent);
  });
});

// ------------------------------
// 🔍 MODAL TÌM KIẾM TRÊN HEADER
// ------------------------------
document.addEventListener("DOMContentLoaded", () => {
  const modal = document.getElementById("searchModal");
  const openBtn = document.getElementById("openSearchModal");
  const closeBtn = modal.querySelector(".close-btn");
  const input = document.getElementById("searchInput");

  // mở modal
  openBtn.addEventListener("click", (e) => {
    e.preventDefault();
    modal.style.display = "flex";
    input.focus();
  });

  // đóng modal
  closeBtn.addEventListener("click", () => (modal.style.display = "none"));
  window.addEventListener("click", (e) => {
    if (e.target === modal) modal.style.display = "none";
  });

  // xử lý gợi ý
  document.querySelectorAll(".search-suggestions button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const text = btn.textContent.trim();
      input.value = text;
      const event = new KeyboardEvent("keypress", { key: "Enter" });
      input.dispatchEvent(event);
    });
  });
});



// =========================================
// ⚙️ KHỞI TẠO KHI TRANG LOAD
// =========================================
document.addEventListener('DOMContentLoaded', () => {
  showSlide(0);
  loadArtifactsPreview();
  loadAllMapMarkers();
  initTimeline();
  loadTimelineList();
  initScrollAnimations();
});

