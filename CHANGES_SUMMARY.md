# Tóm tắt các thay đổi - Tính năng Video & Audio

## Các file đã được chỉnh sửa

### Backend

1. **backend/app.py**

#### Thay đổi 1: Mở rộng ALLOWED_EXTENSIONS (dòng 29)

- **Trước**: `{"png", "jpg", "jpeg", "gif"}`
- **Sau**: `{"png", "jpg", "jpeg", "gif", "mp4", "webm", "mov", "avi", "mp3", "wav", "m4a", "ogg", "flac"}`

#### Thay đổi 2: POST Handler - Thêm xử lý video/audio (dòng 535-620)

- Thêm 3 list mới: `images = []`, `videos = []`, `audios = []`
- Thêm xử lý upload video từ `request.files['videos']`
- Thêm xử lý upload audio từ `request.files['audios']`
- Xử lý tương tự như ảnh: lưu vào thư mục, tạo relative path
- Thêm vào item_data: `item_data["videos"]` và `item_data["audios"]`
- Response bao gồm: `videos_count`, `videos`, `audios_count`, `audios`

#### Thay đổi 3: PUT Handler - Thêm xử lý video/audio (dòng 803-963)

- Thêm 3 list mới: `images = []`, `videos = []`, `audios = []`
- Xử lý upload video tương tự ảnh, giữ video cũ nếu không upload mới
- Xử lý upload audio tương tự ảnh, giữ audio cũ nếu không upload mới
- Thêm vào update_data: `update_data["videos"]` và `update_data["audios"]`

### Frontend - HTML

1. **frontend/admin.html** (sau dòng 55 - form group ảnh)

```html
<div class="form-group">
  <label for="itemVideos">Video (có thể chọn nhiều video):</label>
  <input type="file" name="videos" id="itemVideos" multiple accept="video/*" />
  <small class="file-info"
    >Hỗ trợ: MP4, WebM, MOV, AVI. Giữ Ctrl (Windows) hoặc Command (Mac) để chọn
    nhiều video</small
  >
  <div id="videoPreview" class="media-preview"></div>
</div>

<div class="form-group">
  <label for="itemAudios">Audio (có thể chọn nhiều tệp):</label>
  <input type="file" name="audios" id="itemAudios" multiple accept="audio/*" />
  <small class="file-info"
    >Hỗ trợ: MP3, WAV, M4A, OGG, FLAC. Giữ Ctrl (Windows) hoặc Command (Mac) để
    chọn nhiều tệp</small
  >
  <div id="audioPreview" class="media-preview"></div>
</div>
```

2. **frontend/detail.html** (sau phần map - trước related items)

```html
<!-- Video Section -->
<section
  id="videos-section"
  class="media-section fade-in-up"
  style="display:none;margin-top:20px;"
>
  <h2>📹 Video</h2>
  <div id="videos-container" class="media-container"></div>
</section>

<!-- Audio Section -->
<section
  id="audios-section"
  class="media-section fade-in-up"
  style="display:none;margin-top:20px;"
>
  <h2>🎵 Audio</h2>
  <div id="audios-container" class="media-container"></div>
</section>
```

### Frontend - JavaScript

1. **frontend/js/admin.js**

#### Thay đổi 1: Thêm setupVideoPreview() (dòng 147-162)

```javascript
function setupVideoPreview() {
  const input = document.getElementById("itemVideos");
  const preview = document.getElementById("videoPreview");
  if (!input || !preview) return;
  input.addEventListener("change", (e) => {
    preview.innerHTML = "";
    [...e.target.files].forEach((file) => {
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
```

#### Thay đổi 2: Thêm setupAudioPreview() (dòng 164-179)

```javascript
function setupAudioPreview() {
  const input = document.getElementById("itemAudios");
  const preview = document.getElementById("audioPreview");
  if (!input || !preview) return;
  input.addEventListener("change", (e) => {
    preview.innerHTML = "";
    [...e.target.files].forEach((file) => {
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
```

#### Thay đổi 3: Cập nhật checkAuth() (dòng 310-320)

- Thêm gọi `setupVideoPreview()`
- Thêm gọi `setupAudioPreview()`

2. **frontend/js/detail.js** (sau phần resolveReferencedPlaceNames())

```javascript
// =============== VIDEO SECTION ===============
const videoSection = document.getElementById("videos-section");
const videoContainer = document.getElementById("videos-container");
if (item.videos && item.videos.length > 0) {
  videoSection.style.display = "block";
  videoContainer.innerHTML = "";
  item.videos.forEach((videoPath, idx) => {
    const videoDiv = document.createElement("div");
    videoDiv.className = "video-item";
    videoDiv.style.marginBottom = "16px";
    const videoEl = document.createElement("video");
    videoEl.width = "100%";
    videoEl.height = "auto";
    videoEl.controls = true;
    videoEl.style.borderRadius = "6px";
    const source = document.createElement("source");
    source.src = `/uploads/${videoPath}`;
    const ext = videoPath.split(".").pop().toLowerCase();
    const videoType =
      {
        mp4: "video/mp4",
        webm: "video/webm",
        mov: "video/quicktime",
        avi: "video/x-msvideo",
      }[ext] || "video/mp4";
    source.type = videoType;
    videoEl.appendChild(source);
    videoEl.appendChild(
      document.createTextNode("Trình duyệt của bạn không hỗ trợ video HTML5")
    );
    videoDiv.appendChild(videoEl);
    videoContainer.appendChild(videoDiv);
  });
} else {
  videoSection.style.display = "none";
}

// =============== AUDIO SECTION ===============
const audioSection = document.getElementById("audios-section");
const audioContainer = document.getElementById("audios-container");
if (item.audios && item.audios.length > 0) {
  audioSection.style.display = "block";
  audioContainer.innerHTML = "";
  item.audios.forEach((audioPath, idx) => {
    const audioDiv = document.createElement("div");
    audioDiv.className = "audio-item";
    audioDiv.style.marginBottom = "12px";
    audioDiv.style.padding = "12px";
    audioDiv.style.backgroundColor = "#f5f5f5";
    audioDiv.style.borderRadius = "6px";
    const audioEl = document.createElement("audio");
    audioEl.style.width = "100%";
    audioEl.controls = true;
    const source = document.createElement("source");
    source.src = `/uploads/${audioPath}`;
    const ext = audioPath.split(".").pop().toLowerCase();
    const audioType =
      {
        mp3: "audio/mpeg",
        wav: "audio/wav",
        m4a: "audio/mp4",
        ogg: "audio/ogg",
        flac: "audio/flac",
      }[ext] || "audio/mpeg";
    source.type = audioType;
    audioEl.appendChild(source);
    audioEl.appendChild(
      document.createTextNode("Trình duyệt của bạn không hỗ trợ audio HTML5")
    );
    audioDiv.appendChild(audioEl);
    audioContainer.appendChild(audioDiv);
  });
} else {
  audioSection.style.display = "none";
}
```

### Frontend - CSS

1. **frontend/css/styles.css**

#### Thay đổi 1: Thêm media preview styling (sau dòng 1102)

```css
.media-preview {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 10px;
}

.media-item {
  background: #f9f9f9;
  border: 1px solid #ddd;
  border-radius: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding: 10px;
  width: auto;
  min-width: 200px;
}

.media-icon {
  font-size: 24px;
  text-align: center;
}

.media-name {
  font-size: 12px;
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.media-size {
  color: #999;
  font-size: 10px;
}
```

#### Thay đổi 2: Thêm media section styling (sau dòng 668)

```css
.media-section {
  margin: 32px 40px;
}

.media-section h2 {
  color: #2b2b2b;
  font-family: "Cormorant Garamond", serif;
  font-size: 24px;
  margin: 0 0 20px 0;
}

.media-container {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.video-item {
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
}

.video-item video {
  display: block;
  width: 100%;
  height: auto;
}

.audio-item {
  background: #faf9f6;
  border: 1px solid rgba(166, 123, 91, 0.2);
  border-radius: 8px;
  padding: 16px;
}
```

## Test Checklist

- [ ] Admin có thể upload video khi tạo/chỉnh sửa item
- [ ] Admin có thể upload audio khi tạo/chỉnh sửa item
- [ ] Preview video/audio hiển thị đúng trong admin form
- [ ] Video/audio được lưu trong database (fields: videos, audios)
- [ ] Video/audio được upload vào thư mục uploads đúng vị trí
- [ ] Chi tiết page hiển thị video section (nếu có video)
- [ ] Chi tiết page hiển thị audio section (nếu có audio)
- [ ] Video player hoạt động đúng
- [ ] Audio player hoạt động đúng
- [ ] Sections ẩn khi không có video/audio
- [ ] Multiple video/audio upload hoạt động đúng
- [ ] Chỉnh sửa item giữ video/audio cũ nếu không upload mới
- [ ] DELETE item cũng xóa video/audio từ database

## Tính năng hoàn toàn mới

✅ Video upload/download
✅ Audio upload/download
✅ Media player HTML5 native
✅ Multiple media file support
✅ Media preview trong admin
✅ Responsive design
✅ MIME type auto-detection
✅ Graceful fallback messages
