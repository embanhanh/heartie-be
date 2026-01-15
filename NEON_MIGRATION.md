# Hướng dẫn Chuyển đổi Database sang Neon PostgreSQL

Tài liệu này hướng dẫn chi tiết các bước để migrage database từ local (Docker) lên Neon (Serverless Postgres).

## 1. Chuẩn bị (Trên Dashboard Neon)

1.  **Tạo Project**: Đăng nhập vào Neon console và tạo một project mới.
2.  **Lấy chuỗi kết nối (Connection String)**:
    - Trong Dashboard, tìm phần **Connection details**.
    - Chọn "Parameters" để xem `Host`, `Database`, `User`, `Password`.
    - **Lưu ý**: Neon yêu cầu kết nối qua **SSL**.

## 2. Cài đặt Extension (Bắt buộc)

Do hệ thống sử dụng `pgvector` phục vụ tính năng tìm kiếm bằng hình ảnh và semantic search, bạn phải cài đặt extension này trên Neon **trước khi** chạy ứng dụng hoặc restore dữ liệu.

1.  Truy cập vào **SQL Editor** trên Neon dashboard.
2.  Chạy lệnh sau:
    ```sql
    CREATE EXTENSION IF NOT EXISTS vector;
    ```

## 3. Dump & Restore Dữ liệu

Để chuyển dữ liệu từ local lên Neon, chúng ta sẽ dùng `pg_dump` và `psql`.

### Bước 3.1: Dump dữ liệu từ Local

Chạy lệnh sau trên terminal của bạn (đảm bảo container DB đang chạy):

```bash
# Dump toàn bộ database (schema + data) ra file dump.sql
docker exec -e PGPASSWORD=thongdinh my_postgres_db pg_dump -U thongdinh -d heartie_db > dump.sql
```

_(Thay `heartie-db` bằng tên container database của bạn nếu khác)_

### Bước 3.2: Chỉnh sửa file dump (Nếu cần)

Mở file `dump.sql` và kiểm tra. Nếu thấy dòng `CREATE EXTENSION IF NOT EXISTS vector`, hệ thống Neon có thể báo lỗi permission. Bạn có thể xóa dòng này vì chúng ta đã tạo thủ công ở Bước 2.
Tuy nhiên, `pg_dump` thường thêm `CREATE EXTENSION ...` kèm `COMMENT ON EXTENSION ...`. Xóa các dòng này đi là an toàn nhất.

### Bước 3.3: Restore lên Neon

Sử dụng chuỗi kết nối của Neon để restore:

```bash
# Cấu trúc lệnh
psql "postgres://<user>:<password>@<host>/<dbname>?sslmode=require" < dump.sql

# Ví dụ thực tế:
psql "postgres://neondb_owner:Abc123xyz@ep-fancy-frog-123456.ap-southeast-1.aws.neon.tech/neondb?sslmode=require" < dump.sql
```

## 4. Cập nhật Cấu hình Ứng dụng

Mở file `.env` trong project `heartie-be` và cập nhật các thông số mới:

```properties
# Database Configuration for Neon
DB_HOST=ep-fancy-frog-123456.ap-southeast-1.aws.neon.tech
DB_PORT=5432
DB_USERNAME=neondb_owner
DB_PASSWORD=***********
DB_DATABASE=neondb

# Kích hoạt SSL (BẮT BUỘC với Neon)
DB_SSL=true
```

## 5. Kiểm tra

1.  Khởi động lại backend: `npm run start:dev`
2.  Theo dõi log. Nếu không có lỗi kết nối, quá trình chuyển đổi thành công.
3.  Test tính năng:
    - Đăng nhập.
    - Tạo sản phẩm mới.
    - **Quan trọng**: Test tính năng **Image Search** để đảm bảo `pgvector` hoạt động đúng trên Neon.
