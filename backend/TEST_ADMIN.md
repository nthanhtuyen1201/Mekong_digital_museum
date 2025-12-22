# Test Hệ thống Admin mới

## 1. Cài đặt dependencies mới

cd backend
pip install bcrypt python-dotenv

## 2. Kiểm tra file .env đã được tạo

# File backend/.env phải tồn tại với nội dung:

# SECRET_KEY=supersecretkey-change-in-production

# ADMIN_USER=admin

# ADMIN_PASS=12345

## 3. Khởi động server

cd backend
python app.py

## 4. Khởi tạo admin (chỉ 1 lần)

# Sử dụng PowerShell:

Invoke-WebRequest -Uri "http://localhost:5000/api/init-admin" -Method POST

# Hoặc curl (nếu có):

curl -X POST http://localhost:5000/api/init-admin

## 5. Kiểm tra trong MongoDB

# Mở MongoDB shell:

mongosh
use museum
db.admins.find().pretty()

# Kết quả mong đợi: 1 document với username, hashed password, created_at, role

## 6. Test đăng nhập

# Mở trình duyệt: http://localhost:5000/login

# Nhập: admin / 12345

# Nếu thành công → chuyển đến trang admin

## 7. Lưu ý bảo mật

- Mật khẩu trong MongoDB đã được hash bằng bcrypt
- File .env không được commit lên Git (đã thêm vào .gitignore)
- Trong production, thay đổi ADMIN_PASS và SECRET_KEY thành giá trị mạnh hơn
