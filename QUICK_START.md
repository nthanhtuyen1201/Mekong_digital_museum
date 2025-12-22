# 🚀 Quick Start - Video & Audio Feature

## TL;DR (Quá dài; Chưa đọc)

Bạn giờ có thể:

- 📹 Tải video (MP4, WebM, MOV, AVI)
- 🎵 Tải audio (MP3, WAV, M4A, OGG, FLAC)
- 👀 Xem/nghe trên trang chi tiết
- 📱 Responsive trên mọi device

## Nhanh Gọn

### Tài Admin: Upload Video/Audio

1. **Admin** → **Cổ vật** (hoặc Sự kiện/Di tích)
2. **+ Thêm mới**
3. Điền tên & mô tả
4. Kéo xuống tìm **"Video"** - chọn file
5. Kéo xuống tìm **"Audio"** - chọn file
6. **Lưu** ✅

### Người dùng: Xem/Nghe

1. Mở chi tiết cổ vật/sự kiện/địa điểm bất kỳ
2. Kéo xuống
3. Thấy **"📹 Video"** hoặc **"🎵 Audio"**? → Click Play 🎬

## File Changes

```
backend/
  └─ app.py                 (thêm video/audio support)
frontend/
  ├─ admin.html             (thêm form input)
  ├─ detail.html            (thêm media sections)
  ├─ css/styles.css         (thêm styling)
  └─ js/
      ├─ admin.js           (thêm preview)
      └─ detail.js          (thêm rendering)
```

## Code Changes Summary

### Backend (app.py)

```python
# 1. Formats
ALLOWED_EXTENSIONS = {..., "mp4", "webm", "mp3", "wav", "m4a", ...}

# 2. Upload (POST)
if 'videos' in request.files:
    # ... lưu video
if 'audios' in request.files:
    # ... lưu audio

# 3. Update (PUT)
if videos:
    update_data["videos"] = videos
else:
    update_data["videos"] = current.get("videos", [])  # Giữ cũ
```

### Frontend (HTML)

```html
<input type="file" name="videos" id="itemVideos" multiple accept="video/*" />
<input type="file" name="audios" id="itemAudios" multiple accept="audio/*" />
<section id="videos-section">...</section>
<section id="audios-section">...</section>
```

### Frontend (JS)

```javascript
// Admin
setupVideoPreview()   // preview video files
setupAudioPreview()   // preview audio files

// Detail
render video elements with <video> tag
render audio elements with <audio> tag
auto-detect MIME types from extension
```

### Frontend (CSS)

```css
.media-preview {
  ...;
} /* Preview styling */
.media-section {
  ...;
} /* Media section styling */
.video-item {
  ...;
} /* Video container */
.audio-item {
  ...;
} /* Audio container */
```

## Database

```json
{
  "id": "a3f8c9d12e4b",
  "name": "Item Name",
  "images": ["..."],
  "videos": ["can_tho/artifacts/item_name/1.mp4"],    ← NEW
  "audios": ["can_tho/artifacts/item_name/1.mp3"],    ← NEW
}
```

## Upload Structure

```
backend/uploads/
└── can_tho/
    ├── artifacts/
    │   └── item_name/
    │       ├── 1.jpg       (image)
    │       ├── 2.mp4       (video) ← NEW
    │       └── 3.mp3       (audio) ← NEW
    ├── events/
    │   └── item_name/
    │       └── 1.mp4       ← NEW
    └── places/
        └── item_name/
            └── 1.mp3       ← NEW
```

## API Changes

### Create

```
POST /api/admin/artifacts
  files: images, videos, audios

Response: {videos: [...], audios: [...]}
```

### Update

```
PUT /api/admin/artifacts/id
  files: videos (optional), audios (optional)

Behavior: Giữ cũ nếu không upload mới
```

### Get

```
GET /api/item/id

Response: {videos: [...], audios: [...], ...}
```

## Supported Formats

**Video:** MP4 | WebM | MOV | AVI
**Audio:** MP3 | WAV | M4A | OGG | FLAC

## Features

✅ Upload single/multiple files
✅ Auto-detect MIME types
✅ HTML5 native players
✅ Responsive design
✅ Preview before save
✅ Preserve old media on update
✅ Auto-hide sections if no media

## Test It

```bash
# Terminal 1: MongoDB
mongod

# Terminal 2: App
cd backend
python app.py

# Browser
http://localhost:5000
→ Login → Thêm video/audio → View chi tiết
```

## Common Tasks

### Upload video for item

1. Edit item → Find Video section → Choose .mp4 → Save

### Upload multiple videos

1. Click Video input → Ctrl+Click multiple files → Save

### Update without losing video

1. Edit item → Change info → Don't choose video → Save
   (Video giữ nguyên)

### Replace video

1. Edit item → Choose new video → Save
   (Video cũ bị ghi đè)

### View video

1. Item detail page → Scroll down → See "📹 Video" section → Click play

## Troubleshooting

| Problem             | Solution                   |
| ------------------- | -------------------------- |
| Video won't play    | Check format (try MP4)     |
| Upload fails        | Check file size, format    |
| Preview missing     | Reload page                |
| Section not showing | Check item has video/audio |

## Files Created

- README_VIDEO_AUDIO.md - Full guide
- VIDEO_AUDIO_FEATURE.md - Feature details
- CHANGES_SUMMARY.md - Code changes
- TEST_GUIDE.md - Testing guide
- API_DOCUMENTATION.md - API details
- DEPLOYMENT_CHECKLIST.md - Deployment guide
- QUICK_START.md - This file!

## What's Next?

1. ✅ Feature implemented
2. 📝 Test with real data
3. 🚀 Deploy to production
4. 📊 Monitor usage
5. 📈 Gather feedback
6. 🔄 Future enhancements (transcoding, CDN, etc.)

---

**Ready to use!** 🎉

Question? → See full docs
Bugs? → Check TEST_GUIDE.md
Need API details? → See API_DOCUMENTATION.md
