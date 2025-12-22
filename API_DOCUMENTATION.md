# API Documentation - Video & Audio Support

## Database Schema Changes

### New Fields Added

Các items (artifacts, events, places) có thêm 2 trường mới:

```json
{
  "id": "a3f8c9d12e4b",
  "name": "Item Name",
  "description": "Description",
  "images": ["path/to/image1.jpg", "path/to/image2.jpg"],
  "videos": ["path/to/video1.mp4", "path/to/video2.webm"],
  "audios": ["path/to/audio1.mp3", "path/to/audio2.wav"],
  "...": "other fields"
}
```

**videos**: Array[string]

- Lưu đường dẫn tương đối các file video
- Ví dụ: `["can_tho/artifacts/mat_na/1.mp4"]`

**audios**: Array[string]

- Lưu đường dẫn tương đối các file audio
- Ví dụ: `["can_tho/artifacts/mat_na/1.mp3"]`

## API Endpoints

### Create Item (POST /api/admin/<obj_type>)

**Request:**

```
POST /api/admin/artifacts
Content-Type: multipart/form-data

Fields:
- name: "Artifact Name" (text)
- description: "Description" (text)
- images: File[] (image files)
- videos: File[] (video files) ← NEW
- audios: File[] (audio files) ← NEW
- ... other fields
```

**Response:**

```json
{
  "success": true,
  "id": "a3f8c9d12e4b",
  "images_count": 2,
  "videos_count": 1,        ← NEW
  "audios_count": 1,        ← NEW
  "images": ["path/to/img1.jpg", "path/to/img2.jpg"],
  "videos": ["path/to/video.mp4"],  ← NEW
  "audios": ["path/to/audio.mp3"]   ← NEW
}
```

### Update Item (PUT /api/admin/<obj_type>/<id>)

**Request:**

```
PUT /api/admin/artifacts/a3f8c9d12e4b
Content-Type: multipart/form-data

Fields:
- name: "Updated Name" (text)
- description: "Updated Description" (text)
- images: File[] (image files) - optional
- videos: File[] (video files) - optional ← NEW
- audios: File[] (audio files) - optional ← NEW
- ... other fields
```

**Behavior:**

- Nếu có file video/audio mới → cập nhật
- Nếu không có file mới → giữ video/audio cũ
- Tương tự như logic giữ ảnh cũ

**Response:**

```json
{
  "success": true,
  "updated": true,
  "id": "a3f8c9d12e4b",
  "item": {
    "id": "a3f8c9d12e4b",
    "name": "Updated Name",
    "videos": ["can_tho/artifacts/.../1.mp4"],
    "audios": ["can_tho/artifacts/.../1.mp3"],
    "...": "other fields"
  }
}
```

### Get Item (GET /api/item/<id>)

**Request:**

```
GET /api/item/a3f8c9d12e4b
```

**Response:**

```json
{
  "id": "a3f8c9d12e4b",
  "name": "Item Name",
  "images": ["path/to/image.jpg"],
  "videos": ["path/to/video.mp4"],      ← NEW
  "audios": ["path/to/audio.mp3"],      ← NEW
  "description": "Description",
  "...": "other fields"
}
```

### Get Items (GET /api/admin/<obj_type>)

**Request:**

```
GET /api/admin/artifacts
```

**Response:**

```json
[
  {
    "id": "a3f8c9d12e4b",
    "name": "Item 1",
    "videos": ["path/to/video1.mp4"],   ← NEW
    "audios": ["path/to/audio1.mp3"],   ← NEW
    "..."
  },
  {
    "id": "a3f8c9d12e4c",
    "name": "Item 2",
    "videos": [],                        ← NEW (empty if no videos)
    "audios": [],                        ← NEW (empty if no audios)
    "..."
  }
]
```

## File Upload Details

### Upload Path Structure

```
backend/uploads/
├── {province}/
│   ├── artifacts/
│   │   └── {item_name}/
│   │       ├── 1.jpg
│   │       ├── 2.jpg
│   │       ├── 3.mp4          ← Video
│   │       └── 4.mp3          ← Audio
│   ├── events/
│   │   └── {item_name}/
│   │       └── 1.mp4
│   └── places/
│       └── {item_name}/
│           └── 1.mp3
```

### File Naming Convention

- Sequential numbering: 1.mp4, 2.mp4, 3.mp4
- Tên file gốc được giữ (extension)
- Ví dụ: `video.mp4` → upload thành `3.mp4` (nếu đã có 2 file khác)

### Supported Formats

| Type  | Formats                  | MIME Types                                              |
| ----- | ------------------------ | ------------------------------------------------------- |
| Video | MP4, WebM, MOV, AVI      | video/mp4, video/webm, video/quicktime, video/x-msvideo |
| Audio | MP3, WAV, M4A, OGG, FLAC | audio/mpeg, audio/wav, audio/mp4, audio/ogg, audio/flac |

## Backend Logic

### POST Handler Changes (app.py)

```python
# 1. Xử lý video files
if 'videos' in request.files:
    files = request.files.getlist('videos')
    # Lưu vào thư mục upload
    # Tạo relative path
    # Thêm vào videos list

# 2. Xử lý audio files
if 'audios' in request.files:
    files = request.files.getlist('audios')
    # Lưu vào thư mục upload
    # Tạo relative path
    # Thêm vào audios list

# 3. Lưu vào database
item_data["videos"] = videos
item_data["audios"] = audios
```

### PUT Handler Changes (app.py)

```python
# 1. Nếu có video mới → cập nhật
if videos:
    update_data["videos"] = videos
else:
    update_data["videos"] = current.get("videos", [])  # Giữ cũ

# 2. Nếu có audio mới → cập nhật
if audios:
    update_data["audios"] = audios
else:
    update_data["audios"] = current.get("audios", [])  # Giữ cũ
```

## Frontend Integration

### Admin Form

```javascript
// setupVideoPreview() - render preview khi chọn file
// setupAudioPreview() - render preview khi chọn file

// Form submission tự động xử lý:
const fd = new FormData(e.target); // Tự động include videos/audios inputs
fetch("/api/admin/artifacts", { method: "POST", body: fd });
```

### Detail Page

```javascript
// Render video
if (item.videos && item.videos.length > 0) {
  videoSection.style.display = "block";
  item.videos.forEach((videoPath) => {
    // Tạo <video> element với <source>
    // Auto-detect MIME type từ extension
  });
}

// Render audio
if (item.audios && item.audios.length > 0) {
  audioSection.style.display = "block";
  item.audios.forEach((audioPath) => {
    // Tạo <audio> element với <source>
    // Auto-detect MIME type từ extension
  });
}
```

## Examples

### Example 1: Create Item with Video

```bash
curl -X POST http://localhost:5000/api/admin/artifacts \
  -F "name=Ancient Mask" \
  -F "description=A ceremonial mask" \
  -F "images=@image1.jpg" \
  -F "videos=@video.mp4" \
  -F "audios=@audio.mp3" \
  -H "Cookie: session=YOUR_SESSION_ID"
```

Response:

```json
{
  "success": true,
  "id": "a3f8c9d12e4b",
  "videos_count": 1,
  "videos": ["can_tho/artifacts/ancient_mask/3.mp4"],
  "audios_count": 1,
  "audios": ["can_tho/artifacts/ancient_mask/4.mp3"]
}
```

### Example 2: Update Item - Add New Video

```bash
curl -X PUT http://localhost:5000/api/admin/artifacts/a3f8c9d12e4b \
  -F "videos=@new_video.mp4" \
  -H "Cookie: session=YOUR_SESSION_ID"
```

Response:

```json
{
  "success": true,
  "item": {
    "videos": ["can_tho/artifacts/ancient_mask/5.mp4"]
  }
}
```

### Example 3: Get Item with Videos/Audios

```bash
curl http://localhost:5000/api/item/a3f8c9d12e4b
```

Response:

```json
{
  "id": "a3f8c9d12e4b",
  "name": "Ancient Mask",
  "images": ["can_tho/artifacts/ancient_mask/1.jpg"],
  "videos": ["can_tho/artifacts/ancient_mask/3.mp4"],
  "audios": ["can_tho/artifacts/ancient_mask/4.mp3"]
}
```

## Serving Files

### Direct Access

```
GET /uploads/{province}/{type}/{item_name}/{filename}
```

Example:

```
GET /uploads/can_tho/artifacts/ancient_mask/1.mp4
GET /uploads/can_tho/artifacts/ancient_mask/1.mp3
```

Response: Tệp raw (content-type tự động)

### Via API

Paths được trả về từ API có dạng tương đối:

```json
{
  "videos": ["can_tho/artifacts/ancient_mask/1.mp4"],
  "audios": ["can_tho/artifacts/ancient_mask/1.mp3"]
}
```

Frontend sử dụng:

```javascript
const videoUrl = `/uploads/${videoPath}`; // /uploads/can_tho/artifacts/ancient_mask/1.mp4
```

## Error Handling

### Invalid Format

```json
{
  "error": "Invalid file format. Supported: mp4, webm, mov, avi, mp3, wav, m4a, ogg, flac"
}
```

### File Too Large

```json
{
  "error": "File too large"
}
```

### Database Error

```json
{
  "error": "Error saving to database"
}
```

## Migration Notes

### Existing Items

- Items hiện có không có `videos` và `audios` fields
- Khi render detail page, tự động return `[]` nếu fields không tồn tại
- Không cần migration script - MongoDB schema-less

### Backward Compatibility

- Old items (không có videos/audios) vẫn hoạt động bình thường
- Thêm fields khi cần (create/update)
- GET endpoint tự động return empty arrays nếu không có

## Performance Considerations

- Video/audio files lớn có thể ảnh hưởng upload speed
- Khuyến nghị compress video trước khi upload
- Sử dụng format nén: MP4 H.264 cho video, MP3 128kbps cho audio
- CDN có thể được thêm sau (không implement hiện tại)

## Security Notes

- File extensions được validate bằng `allowed_file()`
- Filenames được secure bằng `secure_filename()`
- Extensions được check (không có executable files)
- Upload directory riêng biệt khỏi Python code
