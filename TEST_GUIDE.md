# Hướng dẫn Test Tính năng Video & Audio

## Chuẩn bị

1. Kiểm tra MongoDB đang chạy trên localhost:27017
2. Chạy backend: `cd backend && python app.py`
3. Mở trình duyệt: `http://localhost:5000`
4. Đăng nhập vào admin panel

## Test Cases

### Test 1: Upload Video khi Tạo Artifact Mới

**Bước thực hiện:**

1. Vào trang Quản lý > Cổ vật
2. Click "Thêm mới"
3. Điền thông tin: Tên = "Test Video", Mô tả = "Artifact có video"
4. Tìm phần "Video (có thể chọn nhiều video)"
5. Click vào input file video
6. Chọn file .mp4 hoặc .webm từ máy tính (hoặc sử dụng video test)
7. **Kiểm tra**: Preview video hiển thị, hiển thị tên file và dung lượng
8. Click "Lưu"
9. **Kiểm tra**:
   - Item được tạo thành công
   - Database MongoDB có field `videos: ["đường/dẫn/video.mp4"]`
   - Tệp được upload vào `backend/uploads/...`

### Test 2: Upload Audio khi Tạo Artifact

**Bước thực hiện:**

1. Vào trang Quản lý > Cổ vật
2. Click "Thêm mới"
3. Điền thông tin: Tên = "Test Audio", Mô tả = "Artifact có audio"
4. Tìm phần "Audio (có thể chọn nhiều tệp)"
5. Click vào input file audio
6. Chọn file .mp3 hoặc .wav từ máy tính
7. **Kiểm tra**: Preview audio hiển thị, hiển thị tên file và dung lượng
8. Click "Lưu"
9. **Kiểm tra**:
   - Item được tạo thành công
   - Database MongoDB có field `audios: ["đường/dẫn/audio.mp3"]`

### Test 3: Upload Nhiều Video Cùng Lúc

**Bước thực hiện:**

1. Vào Quản lý > Cổ vật > Thêm mới
2. Trong phần "Video", chọn 2-3 file video cùng lúc (Ctrl+Click)
3. **Kiểm tra**: Preview hiển thị tất cả video, có số lượng file chính xác
4. Lưu
5. **Kiểm tra**:
   - Database có `videos` array với 2-3 items
   - Tất cả files được upload

### Test 4: Upload Nhiều Audio Cùng Lúc

**Bước thực hiện:**

1. Vào Quản lý > Sự kiện > Thêm mới
2. Trong phần "Audio", chọn 2 file audio (Ctrl+Click)
3. **Kiểm tra**: Preview hiển thị tất cả audio
4. Lưu
5. **Kiểm tra**: Database có `audios` array với 2 items

### Test 5: Chỉnh sửa item - Thêm Video Mới

**Bước thực hiện:**

1. Vào Quản lý > Cổ vật
2. Chọn một artifact hiện có (không có video)
3. Click "Chỉnh sửa"
4. Cuộn xuống, tìm phần Video
5. Chọn file video
6. **Kiểm tra**: Preview hiển thị video vừa chọn
7. Click "Lưu"
8. **Kiểm tra**:
   - Artifact được cập nhật
   - Field `videos` được thêm/cập nhật
   - Các field khác (ảnh, mô tả, v.v.) vẫn giữ nguyên

### Test 6: Chỉnh sửa item - Giữ Video Cũ khi Không Upload Mới

**Bước thực hiện:**

1. Vào Quản lý > Cổ vật
2. Chọn artifact mà đã có video
3. Click "Chỉnh sửa"
4. **Kiểm tra**: Thông tin được load (nhưng không thấy preview video - vì đó là cũ)
5. Chỉ chỉnh sửa mô tả, không chọn video mới
6. Click "Lưu"
7. **Kiểm tra**:
   - Artifact được cập nhật
   - Field `videos` vẫn giữ nguyên (video cũ không bị xóa)
   - Mô tả được cập nhật

### Test 7: Chỉnh sửa item - Thay Thế Video Cũ bằng Video Mới

**Bước thực hiện:**

1. Vào Quản lý > Cổ vật
2. Chọn artifact có video
3. Click "Chỉnh sửa"
4. Trong phần Video, chọn video mới (khác video cũ)
5. Click "Lưu"
6. **Kiểm tra**:
   - Field `videos` được thay thế (video cũ bị ghi đè)
   - Chỉ video mới trong database

### Test 8: Xem Video trên Trang Chi tiết

**Bước thực hiện:**

1. Vào trang Liệt kê hoặc Tìm kiếm
2. Click vào artifact có video
3. Trang chi tiết load
4. Cuộn xuống dưới ảnh
5. **Kiểm tra**:
   - Section "📹 Video" hiển thị
   - Video player HTML5 hiển thị
   - Có nút play, pause, fullscreen, volume
6. Click play
7. **Kiểm tra**: Video phát đúng

### Test 9: Xem Audio trên Trang Chi tiết

**Bước thực hiện:**

1. Click vào event/place có audio
2. Trang chi tiết load
3. Cuộn xuống
4. **Kiểm tra**:
   - Section "🎵 Audio" hiển thị
   - Audio player HTML5 hiển thị
   - Có nút play, pause, volume, timeline
5. Click play
6. **Kiểm tra**: Audio phát đúng

### Test 10: Multiple Media (Video + Audio + Ảnh Cùng Lúc)

**Bước thực hiện:**

1. Tạo artifact mới với:
   - 2-3 ảnh
   - 1 video
   - 1 audio
2. Lưu
3. Xem chi tiết
4. **Kiểm tra**:
   - Ảnh hiển thị trong gallery
   - Video hiển thị trong section Video
   - Audio hiển thị trong section Audio
   - Tất cả hoạt động độc lập

### Test 11: Format Video Khác Nhau

**Bước thực hiện:**

1. Upload video MP4
   - **Kiểm tra**: Phát được
2. Upload video WebM (nếu có)
   - **Kiểm tra**: Phát được
3. **Kết quả**: Tất cả format được hỗ trợ

### Test 12: Format Audio Khác Nhau

**Bước thực hiện:**

1. Upload audio MP3
   - **Kiểm tra**: Phát được
2. Upload audio WAV (nếu có)
   - **Kiểm tra**: Phát được
3. Upload audio M4A (nếu có)
   - **Kiểm tra**: Phát được

### Test 13: Item Không Có Video/Audio

**Bước thực hiện:**

1. Xem chi tiết artifact/event/place không có video/audio
2. **Kiểm tra**:
   - Section "📹 Video" không hiển thị
   - Section "🎵 Audio" không hiển thị
   - Không có lỗi console

### Test 14: Responsive Design

**Bước thực hiện:**

1. Xem chi tiết item có video/audio trên:
   - Desktop (1920px)
   - Tablet (768px)
   - Mobile (375px)
2. **Kiểm tra**: Layout hiển thị đúng trên tất cả kích thước

### Test 15: Cross-browser

**Bước thực hiện:**

1. Test trên:
   - Chrome/Chromium
   - Firefox
   - Safari (nếu có)
   - Edge
2. **Kiểm tra**: Video/audio phát được trên tất cả browser

## File Test (Tạo nếu chưa có)

Bạn có thể sử dụng các file test này hoặc tạo của riêng bạn:

**Video test:**

- Format: MP4 H.264
- Duration: 10-30 giây
- Size: 1-5 MB
- Đặt ở: `test_files/test_video.mp4`

**Audio test:**

- Format: MP3 128kbps
- Duration: 10-30 giây
- Size: 300KB-1MB
- Đặt ở: `test_files/test_audio.mp3`

## Expected Result

✅ Tất cả test cases đều pass
✅ Không có lỗi JavaScript trong console
✅ Không có lỗi backend trong terminal
✅ Media files được upload và serve đúng
✅ Database fields được tạo và cập nhật đúng
✅ UI responsive và user-friendly

## Troubleshooting

**Nếu video không phát:**

- Kiểm tra MIME type: `video/mp4`, `video/webm`, etc.
- Kiểm tra codec: H.264 cho MP4
- Kiểm tra file path trong database
- Thử trực tiếp: `http://localhost:5000/uploads/path/to/video.mp4`

**Nếu audio không phát:**

- Kiểm tra MIME type: `audio/mpeg`, `audio/wav`, etc.
- Kiểm tra file path
- Thử trực tiếp URL

**Nếu preview không hiển thị:**

- Kiểm tra JavaScript console (F12)
- Kiểm tra xem setupVideoPreview/setupAudioPreview được gọi không
- Reload trang

**Nếu upload fail:**

- Kiểm tra file size (< 500MB khuyên nghị)
- Kiểm tra format (chỉ hỗ trợ format đã liệt kê)
- Kiểm tra folder permissions: `backend/uploads/`
- Kiểm tra disk space
