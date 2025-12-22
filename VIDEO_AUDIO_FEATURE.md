# Tính năng Video & Audio - Hướng dẫn sử dụng

## Tổng quan các thay đổi

Các tính năng Video và Audio đã được thêm vào hệ thống bảo tàng số. Admin có thể tải lên video và audio cho các dữ liệu (cổ vật, sự kiện, địa điểm), và người dùng có thể xem/nghe trực tiếp trên trang chi tiết.

## Thay đổi Backend (app.py)

### 1. Mở rộng ALLOWED_EXTENSIONS

- Thêm hỗ trợ cho các định dạng video: `mp4`, `webm`, `mov`, `avi`
- Thêm hỗ trợ cho các định dạng audio: `mp3`, `wav`, `m4a`, `ogg`, `flac`

### 2. POST Handler (/api/admin/<obj_type>)

- Xử lý upload video từ `request.files['videos']`
- Xử lý upload audio từ `request.files['audios']`
- Lưu danh sách video vào field `videos`
- Lưu danh sách audio vào field `audios`
- Response bao gồm `videos_count` và `audios_count`

### 3. PUT Handler (/api/admin/<obj_type>/<id>)

- Xử lý upload video mới, giữ video cũ nếu không có file mới
- Xử lý upload audio mới, giữ audio cũ nếu không có file mới
- Tương tự logic giữ ảnh cũ

## Thay đổi Frontend

### Admin Panel (admin.html)

```html
<div class="form-group">
  <label for="itemVideos">Video (có thể chọn nhiều video):</label>
  <input type="file" name="videos" id="itemVideos" multiple accept="video/*" />
  <small class="file-info">Hỗ trợ: MP4, WebM, MOV, AVI. ...</small>
  <div id="videoPreview" class="media-preview"></div>
</div>

<div class="form-group">
  <label for="itemAudios">Audio (có thể chọn nhiều tệp):</label>
  <input type="file" name="audios" id="itemAudios" multiple accept="audio/*" />
  <small class="file-info">Hỗ trợ: MP3, WAV, M4A, OGG, FLAC. ...</small>
  <div id="audioPreview" class="media-preview"></div>
</div>
```

### Admin JS (admin.js)

- Thêm `setupVideoPreview()` - hiển thị preview danh sách video được chọn
- Thêm `setupAudioPreview()` - hiển thị preview danh sách audio được chọn
- Gọi 2 hàm này trong `checkAuth()`
- FormData tự động xử lý video/audio files (không cần sửa form submission)

### Chi tiết trang (detail.html)

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

### Chi tiết JS (detail.js)

- Thêm logic render video: tạo `<video>` elements với `<source>` tags
- Thêm logic render audio: tạo `<audio>` elements với `<source>` tags
- Tự động ẩn sections nếu không có video/audio
- Hỗ trợ tự động detect MIME type từ file extension

## CSS Styling (styles.css)

### Media Preview (admin panel)

```css
.media-preview {
  /* layout flex cho preview items */
}
.media-item {
  /* styling cho từng item */
}
.media-icon {
  /* emoji icon */
}
.media-name {
  /* tên file */
}
.media-size {
  /* dung lượng file */
}
```

### Media Sections (detail page)

```css
.media-section {
  /* container cho video/audio section */
}
.media-container {
  /* flex column container */
}
.video-item {
  /* styling video player */
}
.audio-item {
  /* styling audio player */
}
```

## Cách sử dụng

### Từ Admin

1. Vào trang Quản lý (Cổ vật/Sự kiện/Di tích)
2. Thêm mới hoặc chỉnh sửa một mục
3. Cuộn xuống, sẽ thấy các form fields mới:
   - **Video**: chọn file video (mp4, webm, mov, avi)
   - **Audio**: chọn file audio (mp3, wav, m4a, ogg, flac)
4. Xem preview của files được chọn
5. Lưu - video/audio sẽ được upload cùng với dữ liệu khác

### Từ Người dùng

1. Vào trang chi tiết của một cổ vật/sự kiện/địa điểm
2. Cuộn xuống dưới ảnh, nếu có video sẽ thấy section **📹 Video**
3. Nếu có audio sẽ thấy section **🎵 Audio**
4. Click play để xem/nghe

## Lưu trữ Files

- Tất cả video/audio được lưu trong thư mục `backend/uploads/`
- Cấu trúc thư mục: `uploads/{province}/{type}/{item_name}/{filename}`
- Ví dụ: `uploads/can_tho/artifacts/van_hoa_khmer/1.mp4`

## Hỗ trợ Format

| Type  | Formats                  |
| ----- | ------------------------ |
| Video | MP4, WebM, MOV, AVI      |
| Audio | MP3, WAV, M4A, OGG, FLAC |

## Cơ sở dữ liệu

Các trường mới trong MongoDB:

- `videos`: Array of strings (đường dẫn file)
- `audios`: Array of strings (đường dẫn file)

Ví dụ document:

```json
{
  "id": "a3f8c9d12e4b",
  "name": "Mặt nạ Khmer cổ",
  "images": ["can_tho/artifacts/mat_na/1.jpg"],
  "videos": ["can_tho/artifacts/mat_na/1.mp4"],
  "audios": ["can_tho/artifacts/mat_na/1.mp3"]
}
```

## Ghi chú kỹ thuật

- Video/Audio được xử lý tương tự như ảnh
- Giữ array cũ nếu không upload file mới (PUT request)
- Tự động xác định MIME type từ extension
- HTML5 native player được sử dụng (không cần JS library bổ sung)
- Responsive design - video/audio scale với container

## Khắc phục sự cố

**Q: Video/Audio không phát được?**
A: Kiểm tra:

1. File được upload thành công (kiểm tra trong thư mục uploads)
2. Đường dẫn file đúng trong database
3. Browser hỗ trợ format (thử mp4 cho video, mp3 cho audio)
4. CORS có bật (đã bật trong app.py)

**Q: Preview không hiển thị khi chọn file?**
A: Kiểm tra xem JavaScript setupVideoPreview() / setupAudioPreview() được gọi?

**Q: Upload bị lỗi?**
A: Kiểm tra:

1. File size < 500MB
2. Folder uploads tồn tại và có quyền ghi
3. Format được hỗ trợ
