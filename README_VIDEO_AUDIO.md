# 🎬 🎵 Tính năng Video & Audio - Hoàn tất Triển khai

## Tổng Quan

Tính năng Video & Audio đã được thêm vào hệ thống Bảo Tàng Số Tây Nam Bộ. Admin có thể tải lên video và audio cho các cổ vật, sự kiện, và địa điểm. Người dùng có thể xem/nghe chúng trực tiếp trên trang chi tiết.

## 🎯 Tính Năng Chính

✅ **Upload Video**

- Hỗ trợ: MP4, WebM, MOV, AVI
- Multiple file upload
- Preview trước khi lưu

✅ **Upload Audio**

- Hỗ trợ: MP3, WAV, M4A, OGG, FLAC
- Multiple file upload
- Preview trước khi lưu

✅ **Xem Video trên Chi tiết**

- HTML5 native video player
- Controls: play, pause, fullscreen, volume
- Responsive design

✅ **Nghe Audio trên Chi tiết**

- HTML5 native audio player
- Controls: play, pause, volume, timeline
- Responsive design

✅ **Quản lý Media**

- Thêm media mới khi tạo item
- Cập nhật media khi chỉnh sửa
- Giữ media cũ khi không upload mới (PUT)
- Delete media khi xóa item

## 📁 Các File Đã Chỉnh Sửa

### Backend

- `backend/app.py` - API endpoints, upload logic
  - ALLOWED_EXTENSIONS: thêm video/audio formats
  - POST handler: xử lý video/audio upload
  - PUT handler: update video/audio, giữ cũ nếu không có mới

### Frontend - HTML

- `frontend/admin.html` - Form inputs mới

  - `<input type="file" name="videos" ... />`
  - `<input type="file" name="audios" ... />`
  - `<div id="videoPreview" class="media-preview"></div>`
  - `<div id="audioPreview" class="media-preview"></div>`

- `frontend/detail.html` - Media sections
  - `<section id="videos-section">...</section>`
  - `<section id="audios-section">...</section>`

### Frontend - JavaScript

- `frontend/js/admin.js`

  - `setupVideoPreview()` - preview video
  - `setupAudioPreview()` - preview audio
  - `checkAuth()` - gọi setup functions

- `frontend/js/detail.js`
  - Render video section
  - Render audio section
  - Auto-detect MIME types

### Frontend - CSS

- `frontend/css/styles.css`
  - `.media-preview` - styling preview items
  - `.media-item` - styling từng item
  - `.media-section` - styling media sections
  - `.video-item` - styling video container
  - `.audio-item` - styling audio container

## 🚀 Cách Sử Dụng

### Từ Admin Panel

#### Tạo Item mới có Video/Audio

1. Vào **Quản lý** (Cổ vật / Sự kiện / Di tích)
2. Click **"+ Thêm mới"**
3. Điền thông tin (Tên, Mô tả, v.v.)
4. Kéo xuống tìm **"Video (có thể chọn nhiều video)"**
5. Click vào, chọn 1 hoặc nhiều file video
6. Tương tự cho **"Audio (có thể chọn nhiều tệp)"**
7. Xem preview của files được chọn
8. Click **"Lưu"** - video/audio sẽ được upload cùng item

#### Chỉnh sửa Item

1. Vào **Quản lý**, chọn item cần edit
2. Click **"Chỉnh sửa"**
3. Thay đổi thông tin
4. **Để thêm video/audio mới**: Chọn files trong phần Video/Audio
5. **Để giữ video/audio cũ**: Không chọn files - sẽ giữ nguyên
6. **Để thay thế**: Chọn files mới - video/audio cũ sẽ bị ghi đè
7. Click **"Lưu"**

### Từ Trang Chi tiết (Người dùng)

1. Xem chi tiết item bất kỳ (cổ vật/sự kiện/địa điểm)
2. Cuộn xuống dưới ảnh
3. Nếu có video: thấy section **"📹 Video"** với video player
4. Nếu có audio: thấy section **"🎵 Audio"** với audio player
5. Click play để xem/nghe

## 📊 Cấu Trúc Dữ Liệu

### Database (MongoDB)

```json
{
  "_id": ObjectId("..."),
  "id": "a3f8c9d12e4b",
  "name": "Mặt nạ Khmer cổ",
  "description": "Một mặt nạ truyền thống...",
  "images": ["can_tho/artifacts/mat_na/1.jpg"],
  "videos": ["can_tho/artifacts/mat_na/1.mp4"],     ← NEW
  "audios": ["can_tho/artifacts/mat_na/1.mp3"],    ← NEW
  "province": "Cần Thơ",
  "..."
}
```

### Upload Structure

```
backend/uploads/
├── can_tho/
│   └── artifacts/
│       └── mat_na_khmer_co/
│           ├── 1.jpg         (image)
│           ├── 2.mp4         (video)
│           └── 3.mp3         (audio)
```

## ✨ Tính Năng Chi tiết

### Video Support

| Format | Codec   | Browser Support               |
| ------ | ------- | ----------------------------- |
| MP4    | H.264   | Chrome, Firefox, Safari, Edge |
| WebM   | VP8/VP9 | Chrome, Firefox, Edge         |
| MOV    | H.264   | Safari, Chrome (partial)      |
| AVI    | MPEG-4  | Limited browser support       |

### Audio Support

| Format | Codec  | Browser Support         |
| ------ | ------ | ----------------------- |
| MP3    | MPEG   | Tất cả browser          |
| WAV    | PCM    | Tất cả browser          |
| M4A    | AAC    | Chrome, Firefox, Safari |
| OGG    | Vorbis | Chrome, Firefox         |
| FLAC   | FLAC   | Limited browser support |

### Player Features

- **Controls**: Play, Pause, Volume, Fullscreen (video)
- **Timeline**: Seek/scrubbing
- **Responsive**: Tự động scale với container
- **Fallback**: Message nếu browser không hỗ trợ

## 🔧 Kỹ Thuật

### MIME Type Auto-Detection

```javascript
const ext = "mp4"; // từ filename
const mimeType = {
  mp4: "video/mp4",
  webm: "video/webm",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  // ...
}[ext];
```

### File Upload Process

1. Admin chọn file
2. Preview hiển thị ngay (tên, dung lượng)
3. Submit form → FormData auto-include files
4. Backend nhận, validate format
5. Lưu vào `uploads/{province}/{type}/{item_name}/`
6. Tạo relative path: `can_tho/artifacts/mat_na/1.mp4`
7. Lưu path vào MongoDB

### File Serving

- Tất cả files serve từ `/uploads/` endpoint
- Static files được phục vụ bởi Flask
- CORS enabled (frontend có thể access)

## 📝 API Endpoints

### Create with Media

```
POST /api/admin/artifacts
Content-Type: multipart/form-data

name=Test
images=@image.jpg
videos=@video.mp4       ← NEW
audios=@audio.mp3       ← NEW
```

Response:

```json
{
  "success": true,
  "videos": ["can_tho/artifacts/.../1.mp4"],
  "audios": ["can_tho/artifacts/.../1.mp3"]
}
```

### Update with New Media

```
PUT /api/admin/artifacts/a3f8c9d12e4b
Content-Type: multipart/form-data

videos=@new_video.mp4       ← Thay thế video cũ
```

### Get Item (includes media paths)

```
GET /api/item/a3f8c9d12e4b
```

Response:

```json
{
  "videos": ["can_tho/artifacts/.../1.mp4"],
  "audios": ["can_tho/artifacts/.../1.mp3"]
}
```

## ⚙️ Configuration

Không cần configuration - tất cả đã được setup mặc định:

- Formats được hỗ trợ: đã thêm vào `ALLOWED_EXTENSIONS`
- Upload folder: `backend/uploads/`
- Static serving: Flask configured sẵn

## 🐛 Troubleshooting

**Q: Video/Audio không phát được?**

- Kiểm tra format được hỗ trợ
- Kiểm tra file path đúng (DevTools Network tab)
- Thử format khác (MP4 most compatible)
- Check browser console (F12) cho lỗi

**Q: Upload fail?**

- Kiểm tra file size (< 500MB)
- Kiểm tra format (MP4, MP3, v.v.)
- Kiểm tra `backend/uploads/` tồn tại

**Q: Preview không hiển thị?**

- Reload admin page
- Kiểm tra JavaScript không có error

**Q: Section Video/Audio không hiển thị?**

- Item cần có videos/audios field
- Check item detail page (DevTools) có data không

## ✅ Test Status

Tất cả tính năng đã được kiểm tra:

- ✅ Upload video single/multiple
- ✅ Upload audio single/multiple
- ✅ Preview hoạt động
- ✅ Database save đúng
- ✅ Display chi tiết page đúng
- ✅ Player hoạt động
- ✅ Edit/update logic
- ✅ Responsive design
- ✅ Cross-browser

## 📚 Tài Liệu

- `VIDEO_AUDIO_FEATURE.md` - Hướng dẫn chi tiết
- `CHANGES_SUMMARY.md` - Danh sách thay đổi code
- `TEST_GUIDE.md` - Hướng dẫn test
- `API_DOCUMENTATION.md` - API reference

## 📞 Support

Nếu gặp vấn đề:

1. Kiểm tra console browser (F12)
2. Kiểm tra terminal Python (lỗi backend)
3. Kiểm tra MongoDB running
4. Review documents liên quan

---

**Triển khai hoàn tất!** 🎉

Hệ thống Bảo Tàng Số Tây Nam Bộ giờ đây hỗ trợ đầy đủ:

- 📷 Ảnh (tồn tại trước đây)
- 📹 Video (mới)
- 🎵 Audio (mới)
