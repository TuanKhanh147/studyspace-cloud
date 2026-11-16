# 🎓 StudySpace Cloud - Nền Tảng Học Tập & Lưu Trữ Tài Liệu Sinh Viên

**StudySpace** là nền tảng trực tuyến thông minh hỗ trợ sinh viên quản lý môn học, lưu trữ tài liệu học tập (giáo trình, slide, bài tập) và ứng dụng trí tuệ nhân tạo (AI) để phân tích, tóm tắt kiến thức ôn thi nhanh chóng.

---

## 🌟 Tính Năng Nổi Bật

1. **Xác thực & Bảo mật (Supabase Authentication)**
   - Đăng ký và đăng nhập bảo mật cho sinh viên.
   - Ghi nhớ thông tin đăng nhập tự động (`Remember Me`).
   - Tự động duy trì phiên làm việc và bảo vệ các trang Dashboard.

2. **Quản lý Môn Học Thông Minh**
   - Thêm, sửa, xóa môn học theo từng học kỳ.
   - Phân biệt môn học bằng bảng màu trực quan.
   - Tìm kiếm nhanh môn học và hiển thị số lượng tài liệu của từng môn.

3. **Kho Lưu Trữ Tài Liệu Sinh Viên (Supabase Storage & Database)**
   - Tải lên các file tài liệu: **PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX**.
   - Chuẩn hóa tên file tự động (hỗ trợ tiếng Việt có dấu an toàn tuyệt đối).
   - Xem trực tiếp tài liệu trên trình duyệt hoặc tải về máy nguyên vẹn.
   - Bộ lọc tài liệu linh hoạt theo môn học và từ khóa tìm kiếm.

4. **Trợ Lý AI Tóm Tắt & Ôn Tập (StudySpace AI Assistant)**
   - Trích xuất nội dung văn bản từ các trang tài liệu PDF.
   - AI phân tích và đúc kết:
     - 📌 Tổng quan chủ đề bài học.
     - 🔑 Các khái niệm & định nghĩa trọng tâm.
     - 📐 Công thức, quy tắc, nguyên lý.
     - 💡 Điểm lưu ý khi ôn thi / làm bài kiểm tra.
   - Sao chép bản tóm tắt chỉ với 1 click.

---

## 🛠️ Công Nghệ Sử Dụng

- **Frontend & Full-stack Framework:** Next.js 16 (App Router, Turbopack, React 19)
- **Styling:** Tailwind CSS v4
- **Backend as a Service:** Supabase (Auth, PostgreSQL Database, Object Storage)
- **PDF Extraction:** PDF.js (`pdfjs-dist`)
- **AI Engine:** OpenAI API (`gpt-4o-mini`)
- **Ngôn ngữ:** TypeScript

---

## 🚀 Cài Đặt & Chạy Cục Bộ

### 1. Cài đặt dependencies
```bash
npm install
```

### 2. Thiết lập biến môi trường
Tạo file `.env.local` ở thư mục gốc:
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_your_key_here
OPENAI_API_KEY=sk-your-openai-api-key
OPENAI_MODEL=gpt-4o-mini
```

### 3. Cấu trúc Database Supabase cần có
- Bảng `subjects`:
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `name` (text)
  - `description` (text, nullable)
  - `color` (text)
  - `created_at` (timestamptz)
- Bảng `documents`:
  - `id` (uuid, primary key)
  - `user_id` (uuid, references auth.users)
  - `subject_id` (uuid, references subjects)
  - `title` (text)
  - `file_name` (text)
  - `file_path` (text)
  - `file_type` (text)
  - `created_at` (timestamptz)
- Bucket Storage trong Supabase: `studyspace-documents` (private hoặc public tùy policy).

### 4. Khởi chạy Server
```bash
npm run dev
```
Truy cập ứng dụng tại: [http://localhost:3000](http://localhost:3000)

### 5. Build Kiểm Tra Sản Phẩm
```bash
npm run build
```

---

## 👥 Tác Giả & Bản Quyền
- Dự án phát triển bởi **StudySpace Team** © 2026.
