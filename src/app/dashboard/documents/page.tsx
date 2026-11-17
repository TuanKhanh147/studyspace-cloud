"use client";

import { useEffect, useState, useMemo, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AuthService,
  DataService,
  SubjectItem,
  DocumentRecord,
} from "@/lib/auth-service";
import {
  FilePdfIcon,
  FileTextIcon,
  UploadCloudIcon,
  EyeIcon,
  DownloadIcon,
  TrashIcon,
  SparklesIcon,
  CopyIcon,
  CheckIcon,
  SearchIcon,
  FolderIcon,
} from "@/components/icons";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

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

function DocumentsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialSubjectFilter = searchParams.get("subjectId") || "";

  const [userId, setUserId] = useState("");
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [documents, setDocuments] = useState<DocumentRecord[]>([]);

  const [searchKeyword, setSearchKeyword] = useState("");
  const [filterSubject, setFilterSubject] = useState(initialSubjectFilter);

  const [title, setTitle] = useState("");
  const [selectedSubject, setSelectedSubject] = useState(initialSubjectFilter);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [extractingId, setExtractingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [extractedText, setExtractedText] = useState("");
  const [extractedTitle, setExtractedTitle] = useState("");
  const [pageCount, setPageCount] = useState(0);

  const [summary, setSummary] = useState("");
  const [summaryTitle, setSummaryTitle] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);

  useEffect(() => {
    async function initialize() {
      const session = await AuthService.getSession();
      if (!session) {
        router.replace("/");
        return;
      }

      setUserId(session.id);

      const [subjs, docs] = await Promise.all([
        DataService.getSubjects(session.id),
        DataService.getDocuments(session.id),
      ]);

      setSubjects(subjs);
      setDocuments(docs);

      if (!selectedSubject && subjs.length > 0 && initialSubjectFilter) {
        setSelectedSubject(initialSubjectFilter);
      }

      setLoading(false);
    }

    initialize();
  }, [router, initialSubjectFilter, selectedSubject]);

  async function loadDocuments() {
    if (!userId) return;
    const docs = await DataService.getDocuments(userId);
    setDocuments(docs);
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

  async function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (err) => reject(err);
      reader.readAsDataURL(file);
    });
  }

  async function uploadDocument(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!userId) {
      setError("Không xác định được phiên làm việc.");
      return;
    }

    if (!title.trim()) {
      setError("Vui lòng nhập tên tài liệu.");
      return;
    }

    if (!selectedSubject) {
      setError("Vui lòng chọn môn học.");
      return;
    }

    if (!selectedFile) {
      setError("Vui lòng chọn file.");
      return;
    }

    setUploading(true);

    try {
      // Chuyển toàn bộ file sang Base64 và lưu vào IndexedDB (không giới hạn)
      let base64Data: string | undefined = undefined;
      try {
        base64Data = await fileToBase64(selectedFile);
      } catch {
        setError("Không thể đọc file. Vui lòng thử lại.");
        setUploading(false);
        return;
      }

      await DataService.saveDocument(
        userId,
        selectedSubject,
        title.trim(),
        selectedFile,
        base64Data
      );

      setTitle("");
      setSelectedFile(null);

      const fileInput = document.getElementById(
        "document-file"
      ) as HTMLInputElement | null;
      if (fileInput) fileInput.value = "";

      setSuccess(`Tải lên thành công: "${selectedFile.name}"`);
      await loadDocuments();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Đã xảy ra lỗi khi tải tài liệu."
      );
    } finally {
      setUploading(false);
    }
  }

  async function extractPdf(doc: DocumentRecord) {
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
      let pdfBlob: Blob | null = null;

      // Load file_data đầy đủ từ IndexedDB
      const fullDoc = await DataService.getDocumentWithData(doc.id);
      const fileData = fullDoc?.file_data || doc.file_data;

      if (fileData) {
        const res = await fetch(fileData);
        pdfBlob = await res.blob();
      }

      if (!pdfBlob) {
        throw new Error("Không thể nạp nội dung tài liệu PDF để đọc.");
      }

      const formData = new FormData();
      const pdfFile = new File([pdfBlob], doc.file_name, {
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
      setSuccess(`Đã trích xuất thành công nội dung ${result.pageCount} trang.`);

      setTimeout(() => {
        document.getElementById("pdf-result")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi đọc file PDF.");
    } finally {
      setExtractingId(null);
    }
  }

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

  async function viewDocument(doc: DocumentRecord) {
    setError("");
    try {
      // Load file_data từ IndexedDB nếu chưa có trong bộ nhớ
      const fullDoc = await DataService.getDocumentWithData(doc.id);
      const fileData = fullDoc?.file_data || doc.file_data;

      if (fileData) {
        const win = window.open();
        if (win) {
          win.document.write(
            `<iframe src="${fileData}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`
          );
          return;
        }
      }
      throw new Error("Không có dữ liệu xem trước cho tài liệu này.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi mở tài liệu.");
    }
  }

  async function downloadDocument(doc: DocumentRecord) {
    setError("");
    setDownloadingId(doc.id);
    try {
      // Load file_data từ IndexedDB
      const fullDoc = await DataService.getDocumentWithData(doc.id);
      const fileData = fullDoc?.file_data || doc.file_data;

      if (fileData) {
        const a = document.createElement("a");
        a.href = fileData;
        a.download = doc.file_name || "document";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        return;
      }
      throw new Error("Không tìm thấy dữ liệu file để tải xuống.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tải file.");
    } finally {
      setDownloadingId(null);
    }
  }

  async function deleteDocument(doc: DocumentRecord) {
    const confirmed = window.confirm(
      `Bạn có chắc chắn muốn xóa tài liệu "${doc.title}" không?`
    );
    if (!confirmed) return;

    setError("");
    setSuccess("");
    setDeletingId(doc.id);

    try {
      await DataService.deleteDocument(userId, doc);

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
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-xs font-medium text-slate-400">Đang tải kho tài liệu...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-10">
      <div className="mx-auto max-w-6xl">
        {/* Nút quay lại */}
        <div className="mb-6 flex items-center justify-between">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            <span>←</span>
            <span>Bảng điều khiển môn học</span>
          </button>
        </div>

        {/* Tiêu đề trang */}
        <section className="mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <FolderIcon size={14} />
            <span>Kho Lưu Trữ Sinh Viên</span>
          </span>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            Quản lý Tài liệu & Giáo trình
          </h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Lưu trữ slide bài giảng, đọc trực tiếp PDF và kích hoạt trí tuệ nhân tạo đúc kết kiến thức ôn thi.
          </p>
        </section>

        {/* Thông báo Thành công / Thất bại */}
        {error && (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300 sm:text-sm">
            {error}
          </div>
        )}
        {success && (
          <div className="mb-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-xs text-emerald-300 sm:text-sm">
            {success}
          </div>
        )}

        {/* Form Tải Tài Liệu Lên */}
        <section className="rounded-2xl border border-slate-800/80 bg-slate-900/90 p-6 backdrop-blur-xl sm:p-7">
          <div className="flex items-center gap-2.5 text-base font-bold text-white sm:text-lg">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-cyan-500/10 text-cyan-400">
              <UploadCloudIcon size={18} />
            </div>
            <h2>Tải tài liệu mới lên bộ nhớ</h2>
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
                placeholder="Ví dụ: Chương 1 - Kiến trúc dữ liệu phân tán"
                className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500"
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
                className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-white outline-none transition focus:border-cyan-500"
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
                className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-xs text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-600 file:to-cyan-600 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:brightness-110"
              />
              <p className="mt-2 text-[11px] text-slate-500">
                Hỗ trợ định dạng: PDF, DOC, DOCX, PPT, PPTX — Tối đa 25 MB mỗi tài liệu.
              </p>
            </div>

            <div className="pt-2 md:col-span-2">
              <button
                type="submit"
                disabled={uploading || subjects.length === 0}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50 sm:text-sm"
              >
                {uploading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                ) : (
                  <UploadCloudIcon size={16} />
                )}
                <span>
                  {uploading ? "Đang tải lên và mã hóa..." : "Tải tài liệu lên"}
                </span>
              </button>

              {subjects.length === 0 && (
                <p className="mt-2 text-xs text-amber-400">
                  Bạn cần tạo ít nhất một môn học trong Dashboard trước khi tải tài liệu.
                </p>
              )}
            </div>
          </form>
        </section>

        {/* Bộ Lọc & Tìm Kiếm Tài Liệu */}
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
              <select
                value={filterSubject}
                onChange={(e) => setFilterSubject(e.target.value)}
                className="rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-500"
              >
                <option value="">Tất cả môn học</option>
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>

              <div className="relative w-full sm:w-60">
                <SearchIcon
                  size={14}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchKeyword}
                  onChange={(e) => setSearchKeyword(e.target.value)}
                  placeholder="Tìm theo tên hoặc file..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-9 pr-3.5 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>
            </div>
          </div>

          {documents.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-400">
                <FolderIcon size={32} />
              </div>
              <p className="mt-4 text-base font-bold text-slate-200">
                Chưa có tài liệu nào trong kho lưu trữ
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Hãy sử dụng biểu mẫu ở trên để tải lên slide hoặc giáo trình môn học đầu tiên nhé!
              </p>
            </div>
          ) : filteredDocuments.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-xs text-slate-400 sm:text-sm">
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
                    className="flex flex-col justify-between rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition hover:border-slate-700 hover:shadow-lg"
                  >
                    <div>
                      <div className="flex items-start gap-3.5">
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl font-bold ${
                            isPdf
                              ? "bg-rose-500/10 text-rose-400"
                              : "bg-cyan-500/10 text-cyan-400"
                          }`}
                        >
                          {isPdf ? <FilePdfIcon size={24} /> : <FileTextIcon size={24} />}
                        </div>

                        <div className="min-w-0 flex-1">
                          <h3 className="break-words text-base font-bold text-white">
                            {doc.title}
                          </h3>

                          <p className="mt-1 break-all text-[11px] text-slate-400">
                            {doc.file_name}
                          </p>

                          <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs">
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
                    <div className="mt-5 flex flex-wrap gap-2 border-t border-slate-800/80 pt-3">
                      {isPdf && (
                        <button
                          onClick={() => extractPdf(doc)}
                          disabled={isExtracting}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-purple-500/15 px-3 py-2 text-xs font-bold text-purple-300 transition hover:bg-purple-600 hover:text-white disabled:opacity-50"
                        >
                          <SparklesIcon size={14} />
                          <span>{isExtracting ? "Đang đọc..." : "AI Tóm tắt"}</span>
                        </button>
                      )}

                      <button
                        onClick={() => viewDocument(doc)}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-600 hover:text-white"
                      >
                        <EyeIcon size={14} />
                        <span>Xem</span>
                      </button>

                      <button
                        onClick={() => downloadDocument(doc)}
                        disabled={isDownloading}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-600 hover:text-white disabled:opacity-50"
                      >
                        <DownloadIcon size={14} />
                        <span>{isDownloading ? "..." : "Tải về"}</span>
                      </button>

                      <button
                        onClick={() => deleteDocument(doc)}
                        disabled={isDeleting}
                        aria-label="Xóa tài liệu"
                        className="flex items-center justify-center rounded-xl bg-red-500/10 px-3 py-2 text-xs font-semibold text-red-400 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* Kết Quả Trích Xuất PDF */}
        {extractedText && (
          <section
            id="pdf-result"
            className="mt-10 rounded-2xl border border-purple-500/30 bg-slate-900/90 p-6 backdrop-blur-xl"
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
                {pageCount} trang tài liệu
              </span>
            </div>

            <div className="mt-4 max-h-96 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-4 font-mono text-xs leading-relaxed text-slate-300">
              {extractedText}
            </div>

            {/* Trợ lý AI Tóm tắt */}
            <div className="mt-6 rounded-2xl border border-purple-500/30 bg-purple-950/20 p-5">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-600 text-white shadow-md shadow-purple-600/30">
                  <SparklesIcon size={20} />
                </div>
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
                  className="flex items-center gap-2 rounded-xl bg-purple-600 px-5 py-2.5 text-xs font-bold text-white shadow-md shadow-purple-600/30 transition hover:bg-purple-500 disabled:opacity-50"
                >
                  <SparklesIcon size={15} />
                  <span>
                    {summarizing
                      ? "AI đang đọc & tổng hợp..."
                      : "Bắt đầu tóm tắt bằng AI"}
                  </span>
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
                  Đóng nội dung
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
                  {summaryError}
                </div>
              )}
            </div>

            {/* Bản Tóm Tắt AI */}
            {summary && (
              <section
                id="ai-summary"
                className="mt-6 rounded-2xl border border-cyan-500/40 bg-slate-950 p-6"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
                  <div>
                    <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                      Bản Tóm Tắt AI Hoàn Chỉnh
                    </span>
                    <h4 className="mt-1 text-lg font-bold text-white">
                      {summaryTitle}
                    </h4>
                  </div>

                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3 py-1 text-xs font-semibold text-emerald-400">
                    <CheckIcon size={14} />
                    <span>Đã tạo thành công</span>
                  </span>
                </div>

                <div className="mt-5 whitespace-pre-wrap break-words text-xs leading-relaxed text-slate-200 sm:text-sm">
                  {summary}
                </div>

                <div className="mt-6 flex flex-wrap gap-2.5 border-t border-slate-800 pt-4">
                  <button
                    onClick={copySummary}
                    className="flex items-center gap-1.5 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-bold text-white hover:bg-cyan-500"
                  >
                    {copySuccess ? <CheckIcon size={15} /> : <CopyIcon size={15} />}
                    <span>{copySuccess ? "Đã sao chép" : "Sao chép tóm tắt"}</span>
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
            <div className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
            <p className="text-xs font-medium text-slate-400">Đang khởi tạo...</p>
          </div>
        </main>
      }
    >
      <DocumentsContent />
    </Suspense>
  );
}
