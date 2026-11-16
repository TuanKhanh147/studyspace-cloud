"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Subject = {
  id: string;
  name: string;
};

type DocumentItem = {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string;
  created_at: string;
};

const BUCKET = "studyspace-documents";
const MAX_FILE_SIZE = 25 * 1024 * 1024; // 25 MB

const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "txt",
  "xls",
  "xlsx",
];

function sanitizeFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  const base = dotIndex !== -1 ? fileName.substring(0, dotIndex) : fileName;
  const ext = dotIndex !== -1 ? fileName.substring(dotIndex + 1).toLowerCase() : "file";

  const cleanBase = base
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .replace(/[^a-zA-Z0-9_-]/g, "_")
    .replace(/_+/g, "_")
    .substring(0, 50);

  const randomStr = Math.random().toString(36).substring(2, 8);
  return `${cleanBase || "doc"}_${randomStr}.${ext}`;
}

function DocumentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSubjectFilter = searchParams.get("subjectId") || "";

  const supabase = createClient();

  const [userId, setUserId] = useState("");
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);

  // Search & Filter state
  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterSubject, setFilterSubject] = useState(initialSubjectFilter);

  // Upload Form state
  const [title, setTitle] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(initialSubjectFilter);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  // Loading states
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  // Notifications
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // PDF Extraction result
  const [extractedText, setExtractedText] = useState("");
  const [extractedTitle, setExtractedTitle] = useState("");
  const [pageCount, setPageCount] = useState(0);

  // AI Summary
  const [summary, setSummary] = useState("");
  const [summaryTitle, setSummaryTitle] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    async function initialize() {
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data?.user) {
        router.replace("/");
        return;
      }

      setUserId(data.user.id);

      const [subjectResult, documentResult] = await Promise.all([
        supabase
          .from("subjects")
          .select("id, name")
          .order("name"),
        supabase
          .from("documents")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      if (subjectResult.error) {
        setError(subjectResult.error.message);
      } else {
        const subjs = subjectResult.data ?? [];
        setSubjects(subjs);
        if (!selectedSubject && subjs.length > 0 && initialSubjectFilter) {
          setSelectedSubject(initialSubjectFilter);
        }
      }

      if (documentResult.error) {
        setError(documentResult.error.message);
      } else {
        setDocuments(documentResult.data ?? []);
      }

      setLoading(false);
    }

    initialize();
  }, [router, supabase, initialSubjectFilter, selectedSubject]);

  async function loadDocuments() {
    const { data, error: docError } = await supabase
      .from("documents")
      .select("*")
      .order("created_at", { ascending: false });

    if (docError) {
      setError(docError.message);
      return;
    }

    setDocuments(data ?? []);
  }

  function handleFileChange(file: File | null) {
    setSelectedFile(null);
    setError("");
    setSuccess("");

    if (!file) return;

    const extension = file.name.split(".").pop()?.toLowerCase();

    if (!extension || !ALLOWED_EXTENSIONS.includes(extension)) {
      setError("Định dạng file không hỗ trợ. Vui lòng chọn PDF, Word, PowerPoint hoặc Excel.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setError("Dung lượng file tối đa là 25 MB.");
      return;
    }

    setSelectedFile(file);

    if (!title.trim()) {
      const baseName = file.name.replace(/\.[^/.]+$/, "");
      setTitle(baseName);
    }
  }

  // Tải tài liệu lên Storage và lưu thông tin vào Database
  async function uploadDocument(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!userId) {
      setError("Không xác định được phiên đăng nhập. Vui lòng đăng nhập lại.");
      return;
    }

    if (!title.trim()) {
      setError("Vui lòng nhập tên tài liệu.");
      return;
    }

    if (!selectedSubject) {
      setError("Vui lòng chọn môn học tương ứng.");
      return;
    }

    if (!selectedFile) {
      setError("Vui lòng chọn file tài liệu cần tải lên.");
      return;
    }

    setUploading(true);

    const extension =
      selectedFile.name.split(".").pop()?.toLowerCase() || "file";

    const safeFileName = sanitizeFileName(selectedFile.name);
    const filePath = `${userId}/${safeFileName}`;

    try {
      const { error: uploadError } = await supabase.storage
        .from(BUCKET)
        .upload(filePath, selectedFile, {
          upsert: true,
          contentType: selectedFile.type || "application/octet-stream",
        });

      if (uploadError) {
        throw new Error(`Lỗi tải lên Storage: ${uploadError.message}`);
      }

      const { error: insertError } = await supabase.from("documents").insert({
        user_id: userId,
        subject_id: selectedSubject,
        title: title.trim(),
        file_name: selectedFile.name,
        file_path: filePath,
        file_type: extension,
      });

      if (insertError) {
        // Rollback storage nếu insert DB lỗi
        await supabase.storage.from(BUCKET).remove([filePath]);
        throw new Error(`Lỗi lưu CSDL: ${insertError.message}`);
      }

      setTitle("");
      setSelectedFile(null);

      const fileInput = document.getElementById(
        "document-file"
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      setSuccess(`Tải lên thành công tài liệu "${selectedFile.name}"!`);
      await loadDocuments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải tài liệu lên."
      );
    } finally {
      setUploading(false);
    }
  }

  // Đọc nội dung PDF bằng API trích xuất
  async function extractPdf(doc: DocumentItem) {
    if (doc.file_type.toLowerCase() !== "pdf") {
      setError("Chức năng đọc tự động hiện hỗ trợ định dạng PDF.");
      return;
    }

    setError("");
    setSuccess("");
    setSummaryError("");
    setSummary("");
    setSummaryTitle("");
    setExtractedText("");
    setExtractedTitle("");
    setPageCount(0);
    setExtractingId(doc.id);

    try {
      const { data: fileBlob, error: downloadError } =
        await supabase.storage.from(BUCKET).download(doc.file_path);

      if (downloadError || !fileBlob) {
        throw new Error(
          downloadError?.message || "Không thể tải file PDF từ bộ nhớ lưu trữ."
        );
      }

      const formData = new FormData();
      const pdfFile = new File([fileBlob], doc.file_name, {
        type: "application/pdf",
      });
      formData.append("file", pdfFile);

      const response = await fetch("/api/extract-pdf", {
        method: "POST",
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.details || result.error || "Không thể trích xuất nội dung PDF."
        );
      }

      setExtractedTitle(doc.title);
      setExtractedText(result.text);
      setPageCount(result.pageCount ?? 0);
      setSuccess(`Đã trích xuất thành công nội dung của ${result.pageCount} trang tài liệu.`);

      setTimeout(() => {
        document.getElementById("pdf-result")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi đọc file PDF.");
    } finally {
      setExtractingId(null);
    }
  }

  // Tóm tắt bằng AI
  async function summarizePdf() {
    if (!extractedText.trim()) {
      setSummaryError("Không có nội dung để tóm tắt.");
      return;
    }

    setSummarizing(true);
    setSummaryError("");
    setSummary("");
    setSummaryTitle("");
    setCopySuccess(false);

    try {
      const response = await fetch("/api/summarize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: extractedText,
          title: extractedTitle,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.details || result.error || "Không thể tóm tắt tài liệu bằng AI."
        );
      }

      if (!result.summary) {
        throw new Error("AI không phản hồi nội dung tóm tắt.");
      }

      setSummary(result.summary);
      setSummaryTitle(extractedTitle);

      setTimeout(() => {
        document.getElementById("ai-summary")?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Lỗi kết nối tới AI.");
    } finally {
      setSummarizing(false);
    }
  }

  // Xem trực tiếp tài liệu
  async function viewDocument(doc: DocumentItem) {
    setError("");
    try {
      const { data, error: urlError } = await supabase.storage
        .from(BUCKET)
        .createSignedUrl(doc.file_path, 3600);

      if (urlError || !data?.signedUrl) {
        throw new Error(urlError?.message || "Không thể tạo liên kết xem file.");
      }

      window.open(data.signedUrl, "_blank", "noopener,noreferrer");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi mở tài liệu.");
    }
  }

  // Tải file về máy với đúng tên file gốc
  async function downloadDocument(doc: DocumentItem) {
    setError("");
    setDownloadingId(doc.id);
    try {
      const { data: blob, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(doc.file_path);

      if (downloadError || !blob) {
        // Fallback mở qua signed url nếu download blob không thành công
        const { data: signedData } = await supabase.storage
          .from(BUCKET)
          .createSignedUrl(doc.file_path, 60);

        if (signedData?.signedUrl) {
          window.open(signedData.signedUrl, "_blank");
          return;
        }
        throw new Error(downloadError?.message || "Không thể tải file về máy.");
      }

      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = doc.file_name || "document";
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tải file.");
    } finally {
      setDownloadingId(null);
    }
  }

  // Xóa tài liệu
  async function deleteDocument(doc: DocumentItem) {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa tài liệu "${doc.title}" không?`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingId(doc.id);

    try {
      await supabase.storage.from(BUCKET).remove([doc.file_path]);

      const { error: dbError } = await supabase
        .from("documents")
        .delete()
        .eq("id", doc.id)
        .eq("user_id", userId);

      if (dbError) throw dbError;

      if (extractedTitle === doc.title) {
        setExtractedText("");
        setExtractedTitle("");
        setPageCount(0);
        setSummary("");
        setSummaryTitle("");
      }

      setSuccess(`Đã xóa tài liệu "${doc.title}" thành công.`);
      await loadDocuments();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa tài liệu.");
    } finally {
      setDeletingId(null);
    }
  }

  async function copySummary() {
    if (!summary) return;
    try {
      await navigator.clipboard.writeText(summary);
      setCopySuccess(true);
      setTimeout(() => setCopySuccess(false), 2500);
    } catch {
      setSummaryError("Không thể sao chép vào bộ nhớ tạm.");
    }
  }

  function getSubjectName(subjectId: string) {
    return (
      subjects.find((subject) => subject.id === subjectId)?.name ||
      "Môn học khác"
    );
  }

  // Lọc tài liệu theo môn học và từ khóa tìm kiếm
  const filteredDocuments = useMemo(() => {
    return documents.filter((doc) => {
      const matchSubject = !filterSubject || doc.subject_id === filterSubject;
      const matchKeyword =
        !searchKeyword.trim() ||
        doc.title.toLowerCase().includes(searchKeyword.toLowerCase().trim()) ||
        doc.file_name.toLowerCase().includes(searchKeyword.toLowerCase().trim());
      return matchSubject && matchKeyword;
    });
  }, [documents, filterSubject, searchKeyword]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Đang tải tài liệu học tập...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        {/* Nút điều hướng quay lại */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            <span>←</span> Quay lại Bảng điều khiển môn học
          </button>
        </div>

        {/* Tiêu đề trang */}
        <section className="mb-8">
          <span className="rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400">
            Kho lưu trữ tài liệu sinh viên
          </span>
          <h1 className="mt-2 text-2xl font-extrabold sm:text-3xl">
            Quản lý tài liệu & Giáo trình
          </h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Tải lên, tổ chức theo môn học, đọc nội dung PDF trực tiếp và ứng dụng AI tóm tắt tài liệu ôn thi.
          </p>
        </section>

        {/* Thông báo Thành công / Thất bại chung */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 sm:text-sm">
            ⚠️ {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl border border-green-500/30 bg-green-500/10 p-4 text-xs text-green-300 sm:text-sm">
            ✅ {success}
          </div>
        )}

        {/* Form Tải Tài Liệu Lên */}
        <section className="rounded-2xl border border-slate-800 bg-slate-900 p-6 sm:p-7">
          <div className="flex items-center gap-2 text-lg font-bold">
            <span>📤</span>
            <h2>Tải tài liệu mới lên kho lưu trữ</h2>
          </div>

          <form onSubmit={uploadDocument} className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Tên tài liệu / Tiêu đề bài học *
              </label>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Ví dụ: Chương 1 - Nhập môn cơ sở dữ liệu"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Môn học tương ứng *
              </label>
              <select
                required
                value={selectedSubject}
                onChange={(e) => setSelectedSubject(e.target.value)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white outline-none transition focus:border-blue-500"
              >
                <option value="">-- Chọn môn học --</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Chọn file tài liệu (PDF, Word, PPT, Excel) *
              </label>
              <input
                id="document-file"
                type="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.xls,.xlsx"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-xs text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-600 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:bg-blue-500"
              />
              <p className="mt-2 text-[11px] text-slate-500">
                Hỗ trợ: PDF, DOC, DOCX, PPT, PPTX — Tối đa 25 MB mỗi tài liệu.
              </p>
            </div>

            <div className="md:col-span-2 pt-2">
              <button
                type="submit"
                disabled={uploading || subjects.length === 0}
                className="flex items-center gap-2 rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {uploading && (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                <span>{uploading ? "Đang tải lên và lưu trữ..." : "Tải tài liệu lên"}</span>
              </button>

              {subjects.length === 0 && (
                <p className="mt-2 text-xs text-amber-400">
                  ⚠️ Bạn cần tạo ít nhất một môn học trong Dashboard trước khi tải tài liệu.
                </p>
              )}
            </div>
          </form>
        </section>

        {/* Thanh Tìm Kiếm & Lọc Danh Sách Tài Liệu */}
        <section className="mt-10">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">
                Danh sách tài liệu đã lưu
              </h2>
              <p className="text-xs text-slate-400">
                Hiển thị {filteredDocuments.length} / {documents.length} tài liệu
              </p>
            </div>

            <div className="flex flex-wrap gap-2.5 sm:items-center">
              {/* Lọc theo môn học */}
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white outline-none focus:border-blue-500"
              >
                <option value="">Tất cả môn học</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>

              {/* Ô tìm kiếm */}
              <input
                type="text"
                value={searchKeyword}
                onChange={(e) => setSearchKeyword(e.target.value)}
                placeholder="🔍 Tìm theo tên hoặc file..."
                className="rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 w-full sm:w-60"
              />
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-12 text-center">
              <div className="text-5xl">📁</div>
              <p className="mt-4 text-base font-bold text-slate-200">
                Chưa có tài liệu nào trong kho lưu trữ
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Hãy sử dụng biểu mẫu ở trên để tải lên slide hoặc giáo trình môn học đầu tiên nhé!
              </p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400 text-sm">
              Không tìm thấy tài liệu phù hợp với bộ lọc hiện tại.
            </div>
          ) : (
            <div className="mt-6 grid gap-4 md:grid-cols-2">
              {filteredDocuments.map((doc) => {
                const isPdf = doc.file_type.toLowerCase() === "pdf";
                const isExtracting = extractingId === doc.id;
                const isDeleting = deletingId === doc.id;
                const isDownloading = downloadingId === doc.id;

                return (
                  <article
                    key={doc.id}
                    className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700 hover:shadow-lg"
                  >
                    <div>
                      <div className="flex items-start gap-3.5">
                        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-blue-600/20 text-2xl font-bold">
                          {isPdf ? "📕" : "📘"}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="text-base font-bold text-white break-words">
                            {doc.title}
                          </h3>

                          <p className="mt-1 text-[11px] text-slate-400 break-all">
                            {doc.file_name}
                          </p>

                          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                            <span className="rounded-md bg-blue-500/10 px-2 py-0.5 font-semibold text-blue-400">
                              {getSubjectName(doc.subject_id)}
                            </span>
                            <span className="rounded-md bg-slate-800 px-2 py-0.5 uppercase text-slate-300">
                              {doc.file_type}
                            </span>
                            <span className="text-[11px] text-slate-500">
                              {new Date(doc.created_at).toLocaleDateString("vi-VN")}
                            </span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Các hành động */}
                    <div className="mt-5 flex flex-wrap gap-2 pt-3 border-t border-slate-800/80">
                      {isPdf && (
                        <button
                          onClick={() => extractPdf(doc)}
                          disabled={isExtracting}
                          className="flex-1 rounded-xl bg-purple-600/20 px-3 py-2 text-xs font-bold text-purple-300 transition hover:bg-purple-600 hover:text-white disabled:opacity-50"
                        >
                          {isExtracting ? "⏳ Đang đọc..." : "✨ Đọc & AI Tóm tắt"}
                        </button>
                      )}

                      <button
                        onClick={() => viewDocument(doc)}
                        className="flex-1 rounded-xl bg-blue-600/20 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-600 hover:text-white"
                      >
                        👁️ Xem
                      </button>

                      <button
                        onClick={() => downloadDocument(doc)}
                        disabled={isDownloading}
                        className="flex-1 rounded-xl bg-emerald-600/20 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                      >
                        {isDownloading ? "..." : "⬇️ Tải về"}
                      </button>

                      <button
                        onClick={() => deleteDocument(doc)}
                        disabled={isDeleting}
                        className="rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                      >
                        {isDeleting ? "..." : "🗑️"}
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Khung Nội Dung PDF Đã Trích Xuất */}
        {extractedText && (
          <section
            id="pdf-result"
            className="mt-10 rounded-2xl border border-purple-500/30 bg-slate-900 p-6"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-purple-500/20 pb-4">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-400">
                  Nội dung trích xuất từ PDF
                </span>
                <h3 className="mt-1 text-xl font-bold text-purple-200">
                  {extractedTitle}
                </h3>
              </div>

              <span className="rounded-full bg-purple-500/20 px-3 py-1 text-xs font-bold text-purple-300">
                📄 {pageCount} trang
              </span>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 text-xs leading-relaxed text-slate-300 font-mono">
              {extractedText}
            </div>

            {/* Trợ lý AI Tóm tắt */}
            <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-950/20 p-5">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-xl text-white">
                  ✨
                </span>
                <div>
                  <h4 className="font-bold text-white">StudySpace AI Assistant</h4>
                  <p className="text-xs text-slate-400">
                    Phân tích toàn bộ văn bản và đúc kết các ý chính, định nghĩa, công thức ôn thi.
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  onClick={summarizePdf}
                  disabled={summarizing}
                  className="rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/30 transition hover:bg-purple-500 disabled:opacity-50"
                >
                  {summarizing ? "✨ AI đang phân tích..." : "✨ Bắt đầu tóm tắt bằng AI"}
                </button>

                <button
                  onClick={() => {
                    setExtractedText("");
                    setExtractedTitle("");
                    setPageCount(0);
                    setSummary("");
                    setSummaryTitle("");
                  }}
                  className="rounded-xl bg-slate-800 px-4 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Đóng tài liệu này
                </button>
              </div>

              {summarizing && (
                <div className="mt-4 flex items-center gap-2 text-xs text-purple-300">
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-purple-400 border-t-transparent" />
                  <span>Hệ thống AI đang đọc và xử lý văn bản, vui lòng đợi trong giây lát...</span>
                </div>
              )}

              {summaryError && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                  ⚠️ {summaryError}
                </div>
              )}
            </div>

            {/* Bản Tóm Tắt AI */}
            {summary && (
              <section
                id="ai-summary"
                className="mt-6 rounded-2xl border border-blue-500/40 bg-slate-950 p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-blue-400">
                      Bản Tóm Tắt AI Hoàn Chỉnh
                    </span>
                    <h4 className="mt-1 text-lg font-bold text-white">
                      {summaryTitle}
                    </h4>
                  </div>

                  <span className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                    ✓ Đã tạo thành công
                  </span>
                </div>

                <div className="mt-5 whitespace-pre-wrap break-words text-xs sm:text-sm leading-relaxed text-slate-200">
                  {summary}
                </div>

                <div className="mt-6 flex flex-wrap gap-2.5 border-t border-slate-800 pt-4">
                  <button
                    onClick={copySummary}
                    className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-500"
                  >
                    {copySuccess ? "✓ Đã sao chép vào bộ nhớ" : "📋 Sao chép tóm tắt"}
                  </button>

                  <button
                    onClick={summarizePdf}
                    disabled={summarizing}
                    className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700 disabled:opacity-50"
                  >
                    Tóm tắt lại
                  </button>
                </div>
              </section>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <div className="flex flex-col items-center gap-3">
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
            <p className="text-sm text-slate-400">Đang khởi tạo...</p>
          </div>
        </main>
      }
    >
      <DocumentsContent />
    </Suspense>
  );
}
