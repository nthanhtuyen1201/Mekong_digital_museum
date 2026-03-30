const params = new URLSearchParams(window.location.search);
const id = params.get("id");

let map = null;
let marker = null;
let currentDetailItem = null;

async function loadDetail() {
  const titleEl = document.getElementById('detail-title');
  const descEl = document.getElementById('detail-desc');
  const thumbs = document.getElementById('gallery-thumbs');
  if (titleEl) titleEl.textContent = 'Đang tải dữ liệu...';
  if (descEl) descEl.textContent = '';
  if (thumbs) thumbs.innerHTML = '';

  try {
    const res = await fetch(`/api/item/${id}`);
    if (!res.ok) {
      if (titleEl) titleEl.textContent = 'Không tìm thấy dữ liệu.';
      if (descEl) descEl.textContent = '';
      return;
    }

    const item = await res.json();
    render(item);
  } catch (e) {
    console.error(e);
    if (titleEl) titleEl.textContent = 'Lỗi tải dữ liệu.';
    if (descEl) descEl.textContent = '';
  }
}

function render(item) {
  currentDetailItem = item;

  const galleryMain = document.getElementById('gallery-main-img');
  const thumbsContainer = document.getElementById('gallery-thumbs');
  // User preference: hide the thumbnail strip completely — only main image + arrows remain
  if (thumbsContainer) thumbsContainer.style.display = 'none';
  const galleryMainWrap = document.getElementById('gallery-main');
  const titleEl = document.getElementById('detail-title');
  const metaEl = document.getElementById('detail-meta');
  const descEl = document.getElementById('detail-desc');
  const linksEl = document.getElementById('detail-links');

  if (!item) {
    if (titleEl) titleEl.textContent = 'Không tìm thấy.';
    if (descEl) descEl.textContent = '';
    return;
  }

  // Images: main + thumbnails
  thumbsContainer.innerHTML = '';
  const imgs = (item.images && item.images.length) ? item.images : [];
  // keep a global list for lightbox / navigation
  window.galleryImages = imgs.slice();
  // store a simple caption (item title) for the lightbox
  window.galleryCaption = item.name || item.title || '';
  const firstSrc = imgs.length ? `/uploads/${imgs[0]}` : 'static/img/noimg.jpg';
  if (galleryMain) galleryMain.src = firstSrc;
  // track current index
  let currentIndex = 0;
  if (galleryMain) galleryMain.dataset.currentIndex = '0';
  if (galleryMain) galleryMain.loading = 'lazy';
  // ensure main image clickable to open lightbox
  if (galleryMain) {
    galleryMain.style.cursor = 'zoom-in';
    galleryMain.onclick = () => openLightbox(galleryMain.src);
  }
  // build thumbnails
  if (imgs.length) {
    imgs.forEach((fn, idx) => {
      const t = document.createElement('img');
      t.src = `/uploads/${fn}`;
      t.alt = '';
      t.loading = 'lazy';
      t.className = 'thumb';
      t.dataset.index = String(idx);
      if (idx === 0) t.classList.add('active');
      t.addEventListener('click', () => {
        showImageByIndex(idx);
      });
      thumbsContainer.appendChild(t);
    });
  // add left/right arrows over main image
    if (galleryMainWrap && !galleryMainWrap.querySelector('.gallery-arrow.left')) {
      const left = document.createElement('button');
      left.className = 'gallery-arrow left';
      left.title = 'Trước';
      left.setAttribute('aria-label','Trước');
      left.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>`;
      left.onclick = (e) => { e.stopPropagation(); prevImage(); };
      const right = document.createElement('button');
      right.className = 'gallery-arrow right';
      right.title = 'Tiếp';
      right.setAttribute('aria-label','Tiếp');
      right.innerHTML = `
        <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
        </svg>`;
      right.onclick = (e) => { e.stopPropagation(); nextImage(); };
      galleryMainWrap.appendChild(left);
      galleryMainWrap.appendChild(right);
    }
    // if there's only one image, hide the thumbnail strip to avoid duplicate large image below
    if (imgs.length <= 1) {
      thumbsContainer.style.display = 'none';
    } else {
      thumbsContainer.style.display = '';
    }
  } else {
    // show placeholder thumb
    const t = document.createElement('img'); t.src = 'static/img/noimg.jpg'; t.alt = ''; t.loading = 'lazy'; thumbsContainer.appendChild(t);
    thumbsContainer.style.display = 'none';
  }

  // Title, meta, desc
  if (titleEl) titleEl.textContent = item.name || item.title || '';
  let meta = '';
  if (item.era) meta += `<p><b>Thời kỳ:</b> ${item.era}</p>`;
  if (item.date) meta += `<p><b>Thời gian:</b> ${item.date}</p>`;
  if (item.location) meta += `<p><b>Địa điểm:</b> <span class="ref-name" data-place-id="${item.location}">${item.location}</span></p>`;
  if (item.museum) meta += `<p><b>Bảo tàng:</b> <span class="ref-name" data-place-id="${item.museum}">${item.museum}</span></p>`;
  if (item.address) meta += `<p><b>Địa chỉ:</b> ${item.address}</p>`;
  if (item.address_after) meta += `<p><b>Địa chỉ mới:</b> ${item.address_after}</p>`;
  if (item.open_hours) meta += `<p><b>Giờ mở cửa:</b> ${item.open_hours}</p>`;
  if (metaEl) metaEl.innerHTML = meta;
  // if (descEl) descEl.textContent = item.description || 'Không có mô tả.';
  if (descEl) descEl.innerHTML = item.description?.replace(/\n/g, '<br>') || 'Không có mô tả.';

  // links
  linksEl.innerHTML = '';
  if (item.links && Array.isArray(item.links) && item.links.length) {
    const header = document.createElement('h3'); header.style.color = '#b8975f'; header.textContent = 'Tài liệu & liên kết tham khảo';
    const ul = document.createElement('ul'); ul.className = 'links-list';
    item.links.forEach(l => {
      const li = document.createElement('li');
      const a = document.createElement('a'); a.href = l.url || l; a.target = '_blank'; a.rel = 'noopener';
      a.textContent = l.title || l.url || l; li.appendChild(a); ul.appendChild(li);
    });
    linksEl.appendChild(header); linksEl.appendChild(ul);
  }

  // resolve any place/museum ids shown as placeholders to their real names
  resolveReferencedPlaceNames();

  // =============== VIDEO SECTION ===============
  const videoSection = document.getElementById('videos-section');
  const videoContainer = document.getElementById('videos-container');
  if (item.videos && item.videos.length > 0) {
    videoSection.style.display = 'block';
    videoContainer.innerHTML = '';
    item.videos.forEach((videoPath, idx) => {
      const videoDiv = document.createElement('div');
      videoDiv.className = 'video-item';
      videoDiv.style.marginBottom = '16px';
      const videoEl = document.createElement('video');
      videoEl.width = '100%';
      videoEl.height = 'auto';
      videoEl.controls = true;
      videoEl.style.borderRadius = '6px';
      const source = document.createElement('source');
      source.src = `/uploads/${videoPath}`;
      // Infer type from extension
      const ext = videoPath.split('.').pop().toLowerCase();
      const videoType = {
        'mp4': 'video/mp4',
        'webm': 'video/webm',
        'mov': 'video/quicktime',
        'avi': 'video/x-msvideo'
      }[ext] || 'video/mp4';
      source.type = videoType;
      videoEl.appendChild(source);
      videoEl.appendChild(document.createTextNode('Trình duyệt của bạn không hỗ trợ video HTML5'));
      videoDiv.appendChild(videoEl);
      videoContainer.appendChild(videoDiv);
    });
  } else {
    videoSection.style.display = 'none';
  }

  // =============== AUDIO SECTION ===============
  const audioSection = document.getElementById('audios-section');
  const audioContainer = document.getElementById('audios-container');
  if (item.audios && item.audios.length > 0) {
    audioSection.style.display = 'block';
    audioContainer.innerHTML = '';
    item.audios.forEach((audioPath, idx) => {
      const audioDiv = document.createElement('div');
      audioDiv.className = 'audio-item';
      audioDiv.style.marginBottom = '12px';
      audioDiv.style.padding = '12px';
      audioDiv.style.backgroundColor = '#f5f5f5';
      audioDiv.style.borderRadius = '6px';
      const audioEl = document.createElement('audio');
      audioEl.style.width = '100%';
      audioEl.controls = true;
      const source = document.createElement('source');
      source.src = `/uploads/${audioPath}`;
      // Infer type from extension
      const ext = audioPath.split('.').pop().toLowerCase();
      const audioType = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'm4a': 'audio/mp4',
        'ogg': 'audio/ogg',
        'flac': 'audio/flac'
      }[ext] || 'audio/mpeg';
      source.type = audioType;
      audioEl.appendChild(source);
      audioEl.appendChild(document.createTextNode('Trình duyệt của bạn không hỗ trợ audio HTML5'));
      audioDiv.appendChild(audioEl);
      audioContainer.appendChild(audioDiv);
    });
  } else {
    audioSection.style.display = 'none';
  }

  // =============== BẢN ĐỒ TỐI ƯU ===============
  if (item.lat && item.lng) {
    const mapContainer = document.getElementById("detail-map");
    mapContainer.style.display = "block";

    if (!map) {
      // Tạo bản đồ chỉ 1 lần
      map = L.map("detail-map", { zoomControl: false }).setView(
        [item.lat, item.lng],
        13
      );

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
        attribution: "© OpenStreetMap contributors",
      }).addTo(map);

      marker = L.marker([item.lat, item.lng])
        .addTo(map)
        .bindPopup(item.name || item.title)
        .openPopup();
    } else {
      // Cập nhật marker & vị trí thay vì tạo mới map
      map.setView([item.lat, item.lng], 13);
      if (marker) marker.setLatLng([item.lat, item.lng]).setPopupContent(item.name || item.title);
      else marker = L.marker([item.lat, item.lng]).addTo(map);
    }
  }

  // =============== HIỆN VẬT LIÊN QUAN ===============
  // Related artifacts
  // show related section
  if ((item.related_artifacts && item.related_artifacts.length) || (item.related_events && item.related_events.length)) {
    document.getElementById("related-section").style.display = "block";
  }

  // render artifacts
  const artContainer = document.getElementById('related-artifacts');
  const artCountEl = document.getElementById('related-artifacts-count');
  const artMoreBtn = document.getElementById('related-artifacts-more');
  artContainer.innerHTML = '';
  if (item.related_artifacts && item.related_artifacts.length) {
    artCountEl.textContent = `(${item.related_artifacts.length})`;
    renderRelatedList(item.related_artifacts, artContainer, 6, artMoreBtn);
  }
   else {
    // fallback
    tryLoadRelatedFallbacks(item);
  }
  

  // render events
  const evContainer = document.getElementById('related-events');
  const evCountEl = document.getElementById('related-events-count');
  const evMoreBtn = document.getElementById('related-events-more');
  evContainer.innerHTML = '';
  if (item.related_events && item.related_events.length) {
    evCountEl.textContent = `(${item.related_events.length})`;
    renderRelatedList(item.related_events, evContainer, 6, evMoreBtn);
  }
}

// helper to show image at index, update thumbnails and scroll into view
function showImageByIndex(idx) {
  const galleryMain = document.getElementById('gallery-main-img');
  if (!galleryMain) return;
  // determine src either from thumbnails (if present) or from global image list
  let src = null;
  const thumbsContainer = document.getElementById('gallery-thumbs');
  if (thumbsContainer) {
    const thumbs = Array.from(thumbsContainer.querySelectorAll('img'));
    const target = thumbs.find(t => Number(t.dataset.index) === idx);
    if (target) {
      // update active thumb if visible
      const prev = thumbsContainer.querySelector('img.active');
      if (prev) prev.classList.remove('active');
      target.classList.add('active');
      src = target.src;
      try { if (thumbsContainer.style.display !== 'none') target.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' }); } catch (e) {}
    }
  }
  if (!src && window.galleryImages && window.galleryImages[idx]) {
    src = `/uploads/${window.galleryImages[idx]}`;
  }
  if (!src) return;
  // change main image with fade
  galleryMain.style.opacity = '0';
  setTimeout(() => {
    galleryMain.src = src;
    galleryMain.style.opacity = '1';
    galleryMain.dataset.currentIndex = String(idx);
  }, 140);
}

function nextImage() {
  const galleryMain = document.getElementById('gallery-main-img');
  const thumbsContainer = document.getElementById('gallery-thumbs');
  if (!galleryMain || !thumbsContainer) return;
  const current = Number(galleryMain.dataset.currentIndex || 0);
  const thumbs = Array.from(thumbsContainer.querySelectorAll('img'));
  const max = thumbs.length - 1;
  const next = current >= max ? 0 : current + 1;
  showImageByIndex(next);
}

function prevImage() {
  const galleryMain = document.getElementById('gallery-main-img');
  const thumbsContainer = document.getElementById('gallery-thumbs');
  if (!galleryMain || !thumbsContainer) return;
  const current = Number(galleryMain.dataset.currentIndex || 0);
  const thumbs = Array.from(thumbsContainer.querySelectorAll('img'));
  const max = thumbs.length - 1;
  const prev = current <= 0 ? max : current - 1;
  showImageByIndex(prev);
}

// keyboard nav
document.addEventListener('keydown', (e) => {
  if (e.key === 'ArrowRight') nextImage();
  if (e.key === 'ArrowLeft') prevImage();
});

// simple swipe support on main image
{ const main = document.getElementById('gallery-main'); if (main) {
    let sx = null;
    main.addEventListener('touchstart', (ev) => { sx = ev.touches[0].clientX; }, { passive: true });
    main.addEventListener('touchend', (ev) => {
      if (sx === null) return; const ex = ev.changedTouches[0].clientX; const dx = ex - sx; if (Math.abs(dx) > 40) { if (dx < 0) nextImage(); else prevImage(); } sx = null;
    });
}}

// Simple lightbox: click main image to open overlay with large image; click overlay or close to dismiss
function openLightbox(src) {
  if (!src) return;
  // prevent duplicate
  if (document.getElementById('lightbox-overlay')) return;
  const overlay = document.createElement('div');
  overlay.id = 'lightbox-overlay';
  overlay.className = 'lightbox-open';
  // click outside image closes
  overlay.onclick = (e) => { if (e.target === overlay) cleanupAndClose(); };

  const img = document.createElement('img');
  img.src = src;
  img.alt = '';
  img.loading = 'eager';

  const caption = document.createElement('div');
  caption.className = 'lightbox-caption';
  caption.textContent = window.galleryCaption || '';

  const closeBtn = document.createElement('button');
  closeBtn.className = 'close-lightbox';
  closeBtn.textContent = 'Đóng ✕';
  closeBtn.onclick = (e) => { e.stopPropagation(); cleanupAndClose(); };

  // left/right arrows for lightbox navigation
  const lArrow = document.createElement('button');
  lArrow.className = 'lightbox-arrow left';
  lArrow.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
    </svg>`;
  lArrow.onclick = (e) => { e.stopPropagation(); lightboxPrev(); };
  const rArrow = document.createElement('button');
  rArrow.className = 'lightbox-arrow right';
  rArrow.innerHTML = `
    <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M8.59 16.59L13.17 12 8.59 7.41 10 6l6 6-6 6z" />
    </svg>`;
  rArrow.onclick = (e) => { e.stopPropagation(); lightboxNext(); };

  overlay.appendChild(lArrow);
  overlay.appendChild(rArrow);
  overlay.appendChild(img);
  overlay.appendChild(caption);
  overlay.appendChild(closeBtn);
  document.body.appendChild(overlay);

  // set current index for lightbox based on galleryImages match
  const idx = (window.galleryImages || []).findIndex(fn => `/uploads/${fn}` === src || fn === src);
  overlay.dataset.currentIndex = String(idx >= 0 ? idx : 0);

  // prevent page scroll while open
  const prevOverflow = document.body.style.overflow;
  document.body.style.overflow = 'hidden';

  // touch swipe support on overlay
  let touchStartX = null;
  function onTouchStart(e) { touchStartX = e.touches && e.touches[0] && e.touches[0].clientX; }
  function onTouchEnd(e) {
    if (touchStartX === null) return; const ex = (e.changedTouches && e.changedTouches[0] && e.changedTouches[0].clientX) || 0; const dx = ex - touchStartX; if (Math.abs(dx) > 40) { if (dx < 0) lightboxNext(); else lightboxPrev(); } touchStartX = null;
  }
  overlay.addEventListener('touchstart', onTouchStart, { passive: true });
  overlay.addEventListener('touchend', onTouchEnd, { passive: true });

  // helper to cleanup listeners and restore state
  function cleanupAndClose() {
    overlay.removeEventListener('touchstart', onTouchStart);
    overlay.removeEventListener('touchend', onTouchEnd);
    if (overlay.parentNode) overlay.parentNode.removeChild(overlay);
    document.body.style.overflow = prevOverflow || '';
  }

  // expose cleanup for other handlers (optional)
  overlay._cleanup = cleanupAndClose;
}

function lightboxNext() {
  const overlay = document.getElementById('lightbox-overlay');
  if (!overlay) return;
  const cur = Number(overlay.dataset.currentIndex || 0);
  const images = window.galleryImages || [];
  if (!images.length) return;
  const next = cur >= images.length-1 ? 0 : cur + 1;
  const img = overlay.querySelector('img');
  if (!img) return;
  img.src = `/uploads/${images[next]}`;
  overlay.dataset.currentIndex = String(next);
}

function lightboxPrev() {
  const overlay = document.getElementById('lightbox-overlay');
  if (!overlay) return;
  const cur = Number(overlay.dataset.currentIndex || 0);
  const images = window.galleryImages || [];
  if (!images.length) return;
  const prev = cur <= 0 ? images.length-1 : cur - 1;
  const img = overlay.querySelector('img');
  if (!img) return;
  img.src = `/uploads/${images[prev]}`;
  overlay.dataset.currentIndex = String(prev);
}

// keyboard nav for lightbox
document.addEventListener('keydown', (e) => {
  const overlay = document.getElementById('lightbox-overlay');
  if (!overlay) return; // only respond when lightbox open
  if (e.key === 'ArrowRight') lightboxNext();
  if (e.key === 'ArrowLeft') lightboxPrev();
  if (e.key === 'Escape') { if (overlay.parentNode) overlay.parentNode.removeChild(overlay); }
});

async function tryLoadRelatedFallbacks(place) {
  // Lightweight client-side fallback: fetch artifacts and events and match by museum/name/location
  const placeName = place.name || '';
  const placeId = place.id || '';
  try {
    const [artsRes, evsRes] = await Promise.all([fetch('/api/artifacts'), fetch('/api/events')]);
    const arts = await artsRes.json();
    const evs = await evsRes.json();
    const relatedArts = [];
    const relatedEvs = [];
    const nameLower = placeName.toLowerCase();
    for (const a of (arts || [])) {
      if ((a.museum && String(a.museum).toLowerCase().includes(nameLower)) || (a.location && String(a.location).toLowerCase().includes(nameLower)) || (a.related_place && a.related_place === placeId) || (a.related_places && a.related_places.includes(placeId))) {
        relatedArts.push(a.id);
      }
    }
    for (const e of (evs || [])) {
      if ((e.location && String(e.location).toLowerCase().includes(nameLower)) || (e.related_place && e.related_place === placeId) || (e.related_places && e.related_places.includes(placeId))) {
        relatedEvs.push(e.id);
      }
    }
    if (relatedArts.length) loadRelated(relatedArts.slice(0, 20));
    if (relatedEvs.length) {
      const container = document.getElementById('related-items');
      const evHeader = document.createElement('h3'); evHeader.style.marginTop = '12px'; evHeader.style.color = '#b8975f'; evHeader.innerText = 'Sự kiện liên quan';
      container.appendChild(evHeader);
      loadRelated(relatedEvs.slice(0, 20));
    }
  } catch (e) {
    console.error('Fallback related load failed', e);
  }
}

// Render a list of related item ids into a container with pagination (showMore button)
async function renderRelatedList(ids, container, initial = 6, moreBtn) {
  const limit = initial;
  let shown = 0;
  container.innerHTML = '';

  async function loadChunk(count) {
    const chunk = ids.slice(shown, shown + count);
    if (!chunk.length) return;
    try {
      // Use bulk endpoint to fetch multiple items in one request
      const url = `/api/items?ids=${chunk.join(',')}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error('Bulk fetch failed');
      const list = await res.json();
      // `list` contains found items in the same order as requested when available
      for (const r of list) {
        try {
          const img = r.images && r.images.length ? `/uploads/${r.images[0]}` : 'static/img/noimg.jpg';
          const card = document.createElement('div');
          card.className = 'related-card';
          card.innerHTML = `
            <img src="${img}" alt="">
            <div class="info">
              <h3>${r.name || r.title}</h3>
              <p style="color:#aaa">${(r.description||'').slice(0,80)}</p>
              <button onclick="openRelated('${r.id}')">Xem chi tiết</button>
            </div>`;
          container.appendChild(card);
        } catch (inner) {
          console.error('Lỗi render liên quan:', inner);
        }
      }
    } catch (e) {
      // Fallback to per-item requests if bulk fails
      console.warn('Bulk related fetch failed, falling back to individual requests', e);
      for (const rid of chunk) {
        try {
          const rres = await fetch(`/api/item/${rid}`);
          if (!rres.ok) continue;
          const r = await rres.json();
          const img = r.images && r.images.length ? `/uploads/${r.images[0]}` : 'static/img/noimg.jpg';
          const card = document.createElement('div');
          card.className = 'related-card';
          card.innerHTML = `
            <img src="${img}" alt="">
            <div class="info">
              <h3>${r.name || r.title}</h3>
              <p style="color:#aaa">${(r.description||'').slice(0,80)}</p>
              <button onclick="openRelated('${r.id}')">Xem chi tiết</button>
            </div>`;
          container.appendChild(card);
        } catch (ee) { console.error('Lỗi tải liên quan (fallback):', ee); }
      }
    }
    shown += chunk.length;
    if (shown >= ids.length) {
      if (moreBtn) moreBtn.style.display = 'none';
    } else {
      if (moreBtn) moreBtn.style.display = 'inline-block';
    }
  }

  // initial load and wire up more
  await loadChunk(limit);
  if (moreBtn) {
    moreBtn.onclick = async () => { await loadChunk(limit); };
  }
}

function openRelated(id) {
  window.location.href = `/detail.html?id=${id}`;
}

// Cache for resolved place names
const placeNameCache = new Map();

function isPlaceId(val) {
  if (!val || typeof val !== 'string') return false;
  return /^p[0-9a-f]+$/i.test(val.trim());
}

async function fetchPlaceName(id) {
  if (!id) return null;
  if (placeNameCache.has(id)) return placeNameCache.get(id);
  try {
    const res = await fetch(`/api/item/${id}`);
    if (!res.ok) return null;
    const data = await res.json();
    const name = data.name || data.title || null;
    if (name) placeNameCache.set(id, name);
    return name;
  } catch (e) {
    return null;
  }
}

// Find all elements with data-place-id and replace their text with the place name when available
async function resolveReferencedPlaceNames() {
  const els = Array.from(document.querySelectorAll('.ref-name[data-place-id]'));
  for (const el of els) {
    const pid = el.getAttribute('data-place-id');
    if (!pid) continue;
    if (!isPlaceId(pid)) continue;
    const name = await fetchPlaceName(pid);
    if (name) el.textContent = name;
    else {
      // fallback: leave the id but maybe prettify
      el.textContent = pid;
    }
  }
}

// Thêm

// Hiệu ứng xuất hiện khi cuộn
document.addEventListener("DOMContentLoaded", () => {
  loadDetail(); //chỉ gọi 1 lần duy nhất

  const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add("visible");
      }
    });
  }, { threshold: 0.2 });

  document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));
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