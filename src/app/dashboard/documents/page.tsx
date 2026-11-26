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
  BookOpenIcon,
  KeyIcon,
  CpuIcon,
} from "@/components/icons";
import { StudyMode } from "@/lib/study-ai-engine";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "ppt",
  "pptx",
  "txt",
  "md",
  "json",
  "csv",
  "xls",
  "xlsx",
];

const AI_KEY_STORAGE = "studyspace_custom_ai_key";
const AI_PROVIDER_STORAGE = "studyspace_ai_provider";

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

  // Trích xuất & AI State
  const [extractedText, setExtractedText] = useState("");
  const [extractedTitle, setExtractedTitle] = useState("");
  const [pageCount, setPageCount] = useState(0);

  const [studyMode, setStudyMode] = useState<StudyMode>("core_focus");
  const [summary, setSummary] = useState("");
  const [summaryTitle, setSummaryTitle] = useState("");
  const [summarizing, setSummarizing] = useState(false);
  const [summaryError, setSummaryError] = useState("");
  const [copySuccess, setCopySuccess] = useState(false);
  const [downloadSuccess, setDownloadSuccess] = useState(false);
  const [engineModel, setEngineModel] = useState("StudySpace Built-in Smart Engine");

  // Custom AI Key modal state
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [customKey, setCustomKey] = useState("");
  const [aiProvider, setAiProvider] = useState("auto");
  const [keySavedMessage, setKeySavedMessage] = useState("");

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

      // Load saved AI keys
      try {
        const savedKey = localStorage.getItem(AI_KEY_STORAGE) || "";
        const savedProvider = localStorage.getItem(AI_PROVIDER_STORAGE) || "auto";
        setCustomKey(savedKey);
        setAiProvider(savedProvider);
      } catch {}

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
      setError("Định dạng file không hỗ trợ. Vui lòng chọn PDF, TXT, Word, PowerPoint hoặc Excel.");
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

  // Trích xuất văn bản từ tài liệu (Hỗ trợ cả PDF và Text/MD/CSV/JSON)
  async function extractDocument(doc: DocumentRecord) {
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
      // 1. Load file_data đầy đủ từ IndexedDB
      const fullDoc = await DataService.getDocumentWithData(doc.id);
      const fileData = fullDoc?.file_data || doc.file_data;

      if (!fileData) {
        throw new Error("Không tìm thấy dữ liệu file trong bộ nhớ để phân tích.");
      }

      const ext = doc.file_type.toLowerCase();
      let textContent = "";
      let count = 1;

      // Nếu là text file hoặc markdown, decode trực tiếp từ Base64
      if (["txt", "md", "json", "csv", "log"].includes(ext)) {
        try {
          const base64Part = fileData.includes(",") ? fileData.split(",")[1] : fileData;
          const binaryStr = atob(base64Part);
          const bytes = new Uint8Array(binaryStr.length);
          for (let i = 0; i < binaryStr.length; i++) {
            bytes[i] = binaryStr.charCodeAt(i);
          }
          textContent = new TextDecoder("utf-8").decode(bytes);
          count = 1;
        } catch {
          throw new Error("Không thể giải mã nội dung văn bản này.");
        }
      } else {
        // Gửi qua API trích xuất (Hỗ trợ PDF, Word .docx, PowerPoint .pptx, etc.)
        const res = await fetch(fileData);
        const fileBlob = await res.blob();

        const formData = new FormData();
        const fileObj = new File([fileBlob], doc.file_name, {
          type: fileBlob.type || "application/octet-stream",
        });
        formData.append("file", fileObj);

        const response = await fetch("/api/extract-pdf", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(
            result.details || result.error || "Không thể trích xuất nội dung từ tài liệu này."
          );
        }

        textContent = result.text;
        count = result.pageCount ?? 1;
      }

      if (!textContent.trim()) {
        throw new Error("Tài liệu không có nội dung văn bản nào để phân tích.");
      }

      setExtractedTitle(doc.title);
      setExtractedText(textContent);
      setPageCount(count);
      setSuccess(`Đã nạp thành công nội dung tài liệu: "${doc.title}".`);

      // Tự động phân tích ngay lập tức với chế độ hiện tại
      runAiAnalysis(textContent, doc.title, studyMode);

      setTimeout(() => {
        document.getElementById("pdf-result")?.scrollIntoView({ behavior: "smooth" });
      }, 100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi đọc tài liệu.");
    } finally {
      setExtractingId(null);
    }
  }

  // Chạy AI phân tích với chế độ được chỉ định
  async function runAiAnalysis(
    textToAnalyze?: string,
    titleToAnalyze?: string,
    modeToRun?: StudyMode
  ) {
    const text = textToAnalyze || extractedText;
    const docTitle = titleToAnalyze || extractedTitle || "Tài liệu học tập";
    const mode = modeToRun || studyMode;

    if (!text.trim()) {
      setSummaryError("Không có nội dung để phân tích.");
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
          content: text,
          title: docTitle,
          mode,
          customApiKey: customKey,
          provider: aiProvider,
        }),
      });

      const result = await response.json();

      if (!response.ok && !result.summary) {
        throw new Error(
          result.details || result.error || "Không thể phân tích tài liệu bằng AI."
        );
      }

      if (!result.summary) {
        throw new Error("Không nhận được nội dung phân tích.");
      }

      setSummary(result.summary);
      setSummaryTitle(docTitle);
      if (result.modelName) {
        setEngineModel(result.modelName);
      }

      setTimeout(() => {
        document.getElementById("ai-summary")?.scrollIntoView({ behavior: "smooth" });
      }, 150);
    } catch (err) {
      setSummaryError(err instanceof Error ? err.message : "Lỗi kết nối tới AI.");
    } finally {
      setSummarizing(false);
    }
  }

  // Chuyển chế độ ôn tập và chạy lại AI
  function switchStudyMode(newMode: StudyMode) {
    setStudyMode(newMode);
    if (extractedText) {
      runAiAnalysis(extractedText, extractedTitle, newMode);
    }
  }

  async function viewDocument(doc: DocumentRecord) {
    setError("");
    try {
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

  // Chuyển đổi Markdown sang HTML cho bản in PDF
  function formatMarkdownToHtml(markdown: string): string {
    let html = markdown
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    // Blockquote
    html = html.replace(/^&gt;\s?(.*)$/gm, "<blockquote>$1</blockquote>");

    // Tiêu đề
    html = html
      .replace(/^### (.*$)/gm, "<h3>$1</h3>")
      .replace(/^## (.*$)/gm, "<h2>$1</h2>")
      .replace(/^# (.*$)/gm, "<h1>$1</h1>");

    // Định dạng chữ
    html = html
      .replace(/\*\*\*(.*?)\*\*\*/g, "<strong><em>$1</em></strong>")
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Đường kẻ ngang
    html = html.replace(/^---$/gm, "<hr />");

    // Code inline
    html = html.replace(/`([^`]+)`/g, "<code>$1</code>");

    // Danh sách
    html = html.replace(/^[\*\-]\s+(.*)$/gm, "<li>$1</li>");
    html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, "<ul>$1</ul>");

    // Đoạn văn
    const blocks = html.split(/\n\s*\n/);
    html = blocks
      .map((block) => {
        block = block.trim();
        if (!block) return "";
        if (
          block.startsWith("<h1") ||
          block.startsWith("<h2") ||
          block.startsWith("<h3") ||
          block.startsWith("<ul") ||
          block.startsWith("<blockquote") ||
          block.startsWith("<hr")
        ) {
          return block;
        }
        return `<p>${block.replace(/\n/g, "<br />")}</p>`;
      })
      .join("\n");

    return html;
  }

  // Xuất tài liệu ôn tập thành file PDF chuẩn A4
  function exportStudyGuideToPdf() {
    if (!summary) return;

    const modeLabels: Record<StudyMode, string> = {
      core_focus: "Phân tích Trọng tâm & Khái niệm Cốt lõi",
      study_guide: "Đề cương Ôn thi Toàn diện",
      practice_quiz: "Bộ Câu hỏi & Trắc nghiệm Tự luyện",
      quick_flashcards: "Thẻ Ghi nhớ Tốc hành (Flashcards 60s)",
    };

    const modeLabel = modeLabels[studyMode] || "Tài liệu Ôn tập";
    const docTitle = summaryTitle || "Tài liệu học tập";
    const dateStr = new Date().toLocaleDateString("vi-VN", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const formattedBody = formatMarkdownToHtml(summary);

    const printHtml = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>[StudySpace] ${docTitle} - ${modeLabel}</title>
  <style>
    @page {
      size: A4;
      margin: 15mm 15mm 15mm 15mm;
    }
    *, *:before, *:after {
      box-sizing: border-box;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      color: #0f172a;
      background: #f8fafc;
      margin: 0;
      padding: 0;
      line-height: 1.65;
      font-size: 13.5px;
    }
    .no-print {
      position: sticky;
      top: 0;
      background: #0f172a;
      color: #f8fafc;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid #334155;
      z-index: 1000;
      box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    .no-print-btn {
      background: linear-gradient(135deg, #0284c7, #2563eb);
      color: #ffffff;
      border: none;
      padding: 8px 18px;
      border-radius: 8px;
      font-weight: 700;
      font-size: 13px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
    }
    .no-print-btn:hover {
      filter: brightness(1.1);
    }
    .page-container {
      max-width: 850px;
      margin: 24px auto;
      background: #ffffff;
      padding: 40px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      border: 1px solid #e2e8f0;
    }
    .header-banner {
      border-bottom: 2px solid #0284c7;
      padding-bottom: 18px;
      margin-bottom: 24px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .brand-title {
      font-size: 22px;
      font-weight: 900;
      color: #0284c7;
      letter-spacing: -0.5px;
    }
    .brand-subtitle {
      font-size: 10.5px;
      font-weight: 700;
      color: #64748b;
      text-transform: uppercase;
      letter-spacing: 1px;
      margin-top: 2px;
    }
    .meta-box {
      text-align: right;
      font-size: 11px;
      color: #64748b;
    }
    .meta-badge {
      display: inline-block;
      background: #e0f2fe;
      color: #0369a1;
      padding: 3px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 11px;
      margin-bottom: 4px;
    }
    .doc-headline {
      font-size: 22px;
      font-weight: 800;
      color: #0f172a;
      margin: 0 0 16px 0;
      line-height: 1.3;
    }
    h1, h2, h3, h4 {
      color: #0369a1;
      page-break-after: avoid;
    }
    h2 {
      font-size: 16px;
      font-weight: 800;
      border-bottom: 1px solid #e2e8f0;
      padding-bottom: 6px;
      margin-top: 24px;
      margin-bottom: 12px;
      color: #0369a1;
    }
    h3 {
      font-size: 14.5px;
      font-weight: 700;
      margin-top: 18px;
      margin-bottom: 8px;
      color: #1e293b;
    }
    p {
      margin: 8px 0;
      text-align: justify;
    }
    ul, ol {
      padding-left: 22px;
      margin: 8px 0 14px 0;
    }
    li {
      margin-bottom: 6px;
    }
    strong {
      color: #0f172a;
    }
    blockquote {
      background: #f0f9ff;
      border-left: 4px solid #0284c7;
      padding: 10px 16px;
      margin: 12px 0;
      border-radius: 0 8px 8px 0;
      color: #0369a1;
      font-size: 13px;
    }
    code {
      background: #f1f5f9;
      color: #0284c7;
      padding: 2px 5px;
      border-radius: 4px;
      font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
    }
    hr {
      border: 0;
      border-top: 1px solid #e2e8f0;
      margin: 20px 0;
    }
    .footer-note {
      border-top: 1px solid #e2e8f0;
      padding-top: 14px;
      margin-top: 36px;
      display: flex;
      justify-content: space-between;
      font-size: 10.5px;
      color: #94a3b8;
      page-break-inside: avoid;
    }
    @media print {
      body {
        background: #ffffff;
      }
      .no-print {
        display: none !important;
      }
      .page-container {
        max-width: 100% !important;
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
      }
      h2, h3 {
        page-break-after: avoid;
      }
      blockquote, p, li {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="no-print">
    <div>
      <strong>📄 Bản In & Xuất File PDF - StudySpace Cloud</strong>
      <div style="font-size: 11px; opacity: 0.8; margin-top: 2px;">
        Hộp thoại in sẽ tự động mở. Vui lòng chọn <strong>"Lưu dưới dạng PDF" (Save as PDF)</strong> để tải file về máy.
      </div>
    </div>
    <div style="display: flex; gap: 8px;">
      <button class="no-print-btn" onclick="window.print()">
        🖨️ Lưu file PDF / In ngay
      </button>
      <button class="no-print-btn" style="background: #334155;" onclick="window.close()">
        ✕ Đóng
      </button>
    </div>
  </div>

  <div class="page-container">
    <div class="header-banner">
      <div>
        <div class="brand-title">StudySpace Cloud</div>
        <div class="brand-subtitle">Hệ Thống Trợ Lý Học Tập & Ôn Thi AI 2026</div>
      </div>
      <div class="meta-box">
        <div class="meta-badge">${modeLabel}</div>
        <div>Ngày xuất: ${dateStr}</div>
      </div>
    </div>

    <h1 class="doc-headline">${docTitle}</h1>

    <div class="content-body">
      ${formattedBody}
    </div>

    <div class="footer-note">
      <span>Được biên soạn tự động bởi StudySpace AI Engine</span>
      <span>Nền tảng Quản lý Học tập & Lưu trữ Đám mây Sinh viên</span>
    </div>
  </div>

  <script>
    window.onload = function() {
      setTimeout(function() {
        window.print();
      }, 350);
    };
  </script>
</body>
</html>`;

    const printWin = window.open("", "_blank");
    if (printWin) {
      printWin.document.open();
      printWin.document.write(printHtml);
      printWin.document.close();
    } else {
      alert("Vui lòng cho phép trình duyệt mở cửa sổ bật lên (pop-up) để xuất file PDF.");
    }
  }

  // Tải tài liệu ôn tập thành file Markdown (.md)
  function downloadStudyGuide() {
    if (!summary) return;
    try {
      const blob = new Blob(["\uFEFF" + summary], {
        type: "text/markdown;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const cleanTitle = (summaryTitle || "Tai_lieu_on_tap").replace(
        /[^\w\d\s\u00C0-\u1EF9]/gi,
        "_"
      );
      a.download = `[StudySpace]_${cleanTitle}_${studyMode}.md`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 2500);
    } catch {
      setSummaryError("Không thể tải file đề cương ôn tập.");
    }
  }

  function handleSaveKey(e: React.FormEvent) {
    e.preventDefault();
    try {
      localStorage.setItem(AI_KEY_STORAGE, customKey.trim());
      localStorage.setItem(AI_PROVIDER_STORAGE, aiProvider);
      setKeySavedMessage("Đã lưu cấu hình AI thành công!");
      setTimeout(() => {
        setKeySavedMessage("");
        setShowKeyModal(false);
      }, 1200);
    } catch {
      setKeySavedMessage("Lỗi lưu vào bộ nhớ trình duyệt.");
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
        {/* Thanh Điều Hướng Trên */}
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <button
            onClick={() => router.push("/dashboard")}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-800 bg-slate-900/80 px-4 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-700 hover:bg-slate-800 hover:text-white"
          >
            <span>←</span>
            <span>Bảng điều khiển môn học</span>
          </button>

          <button
            onClick={() => setShowKeyModal(true)}
            className="inline-flex items-center gap-2 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20 hover:text-white"
          >
            <KeyIcon size={14} className="text-cyan-400" />
            <span>Cài đặt Khóa AI (Tùy chọn)</span>
          </button>
        </div>

        {/* Modal Cấu hình AI Key */}
        {showKeyModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
            <div className="w-full max-w-md rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2 text-base font-bold text-white">
                  <CpuIcon size={18} className="text-cyan-400" />
                  <span>Cấu hình Động cơ AI StudySpace</span>
                </div>
                <button
                  onClick={() => setShowKeyModal(false)}
                  className="rounded-lg p-1 text-slate-400 hover:bg-slate-800 hover:text-white"
                >
                  ✕
                </button>
              </div>

              <form onSubmit={handleSaveKey} className="mt-4 space-y-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    Chọn Mô Hình Ưu Tiên
                  </label>
                  <select
                    value={aiProvider}
                    onChange={(e) => setAiProvider(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 text-xs text-white outline-none focus:border-cyan-500"
                  >
                    <option value="auto">Tự động (Khuyên dùng - Fallback thông minh)</option>
                    <option value="gemini">Google Gemini AI (Tốc độ cao, miễn phí nhiều)</option>
                    <option value="openai">OpenAI (GPT-4o Mini)</option>
                    <option value="builtin">StudySpace Smart Built-in Engine (Không cần Key)</option>
                  </select>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                    Khóa API Cá Nhân (Gemini hoặc OpenAI)
                  </label>
                  <input
                    type="password"
                    value={customKey}
                    onChange={(e) => setCustomKey(e.target.value)}
                    placeholder="AIzaSy... hoặc sk-proj-..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-800 px-3.5 py-2.5 font-mono text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                  />
                  <p className="mt-1.5 text-[11px] leading-relaxed text-slate-400">
                    💡 <em>Nếu để trống:</em> Hệ thống sẽ tự động dùng khóa hệ thống hoặc chuyển sang <strong>StudySpace Smart Engine</strong> hoàn toàn miễn phí, không bao giờ lo hết lượt.
                  </p>
                </div>

                {keySavedMessage && (
                  <p className="rounded-lg bg-emerald-500/10 p-2 text-xs font-semibold text-emerald-400">
                    {keySavedMessage}
                  </p>
                )}

                <div className="flex justify-end gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowKeyModal(false)}
                    className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                  >
                    Đóng
                  </button>
                  <button
                    type="submit"
                    className="rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-4 py-2 text-xs font-bold text-white shadow-md hover:brightness-110"
                  >
                    Lưu cấu hình
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Tiêu đề trang */}
        <section className="mb-8">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-400">
            <SparklesIcon size={14} />
            <span>AI TRỢ LÝ ÔN TẬP & KHO LƯU TRỮ V2.0</span>
          </span>
          <h1 className="mt-2 text-2xl font-black sm:text-3xl">
            Tài liệu Môn học & AI Trợ Lý Ôn Thi
          </h1>
          <p className="mt-1 text-xs text-slate-400 sm:text-sm">
            Lưu trữ slide bài giảng không giới hạn qua IndexedDB. Tự động bóc tách trọng tâm, tạo đề cương và xuất bộ câu hỏi trắc nghiệm tự luyện chỉ trong một thao tác.
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
            <h2>Tải tài liệu mới lên bộ nhớ không giới hạn</h2>
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
                Chọn file tài liệu (PDF, TXT, Word, PPT, Excel) *
              </label>
              <input
                id="document-file"
                type="file"
                accept=".pdf,.txt,.md,.json,.csv,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                onChange={(e) => handleFileChange(e.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-xs text-slate-300 file:mr-4 file:rounded-lg file:border-0 file:bg-gradient-to-r file:from-blue-600 file:to-cyan-600 file:px-4 file:py-2 file:text-xs file:font-bold file:text-white hover:file:brightness-110"
              />
              <p className="mt-2 text-[11px] text-slate-500">
                Hỗ trợ định dạng: PDF, TXT, MD, DOC, DOCX, PPT — Bộ nhớ IndexedDB lưu hàng trăm tài liệu trực tiếp trên thiết bị.
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

        {/* ======================================================== */}
        {/* TRUNG TÂM PHÂN TÍCH & ÔN TẬP THI VỚI AI (NẾU CÓ DỮ LIỆU) */}
        {/* ======================================================== */}
        {extractedText && (
          <section
            id="pdf-result"
            className="mt-10 overflow-hidden rounded-3xl border border-cyan-500/40 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8"
          >
            {/* Header phân tích */}
            <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-800 pb-5">
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 text-white shadow-lg shadow-cyan-500/30">
                  <SparklesIcon size={24} />
                </div>
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-cyan-400">
                    StudySpace AI Learning Hub
                  </span>
                  <h3 className="text-xl font-black text-white sm:text-2xl">
                    {extractedTitle}
                  </h3>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-1.5 text-xs font-semibold text-slate-300">
                  📄 {pageCount} trang tài liệu
                </span>
                <span className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-bold text-cyan-300">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-cyan-400" />
                  <span>{engineModel}</span>
                </span>
              </div>
            </div>

            {/* TAB CHUYỂN ĐỔI CHẾ ĐỘ ÔN TẬP */}
            <div className="mt-6">
              <p className="mb-2 text-xs font-semibold text-slate-400">
                CHỌN CHẾ ĐỘ ÔN TẬP VỚI AI:
              </p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => switchStudyMode("core_focus")}
                  className={`flex items-center justify-center gap-2 rounded-2xl p-3 text-xs font-bold transition sm:text-sm ${
                    studyMode === "core_focus"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20"
                      : "border border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <SparklesIcon size={16} />
                  <span>🎯 Phân tích Trọng tâm</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchStudyMode("study_guide")}
                  className={`flex items-center justify-center gap-2 rounded-2xl p-3 text-xs font-bold transition sm:text-sm ${
                    studyMode === "study_guide"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20"
                      : "border border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <BookOpenIcon size={16} />
                  <span>📚 Đề cương Ôn thi</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchStudyMode("practice_quiz")}
                  className={`flex items-center justify-center gap-2 rounded-2xl p-3 text-xs font-bold transition sm:text-sm ${
                    studyMode === "practice_quiz"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20"
                      : "border border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <CheckIcon size={16} />
                  <span>❓ Trắc nghiệm & Tự luyện</span>
                </button>

                <button
                  type="button"
                  onClick={() => switchStudyMode("quick_flashcards")}
                  className={`flex items-center justify-center gap-2 rounded-2xl p-3 text-xs font-bold transition sm:text-sm ${
                    studyMode === "quick_flashcards"
                      ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-lg shadow-cyan-500/20"
                      : "border border-slate-800 bg-slate-950/60 text-slate-400 hover:border-slate-700 hover:text-white"
                  }`}
                >
                  <CpuIcon size={16} />
                  <span>⚡ Flashcards (60s)</span>
                </button>
              </div>
            </div>

            {/* Trạng thái đang tải */}
            {summarizing && (
              <div className="mt-8 flex flex-col items-center justify-center rounded-2xl border border-cyan-500/20 bg-cyan-950/20 p-8 text-center">
                <div className="h-10 w-10 animate-spin rounded-full border-4 border-cyan-400 border-t-transparent" />
                <p className="mt-3 text-sm font-bold text-white">
                  Đang phân tích cấu trúc & tạo tài liệu học tập...
                </p>
                <p className="mt-1 text-xs text-cyan-300">
                  AI đang trích xuất các công thức, định nghĩa và tổng hợp nội dung ôn thi.
                </p>
              </div>
            )}

            {/* Lỗi */}
            {summaryError && (
              <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-xs text-red-300">
                {summaryError}
              </div>
            )}

            {/* Nội dung kết quả AI */}
            {summary && !summarizing && (
              <article
                id="ai-summary"
                className="mt-6 rounded-2xl border border-slate-800 bg-slate-950 p-6 sm:p-8"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
                  <div className="flex items-center gap-2">
                    <span className="flex h-3 w-3 rounded-full bg-emerald-400" />
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                      Tài Liệu Ôn Tập Đã Sẵn Sàng
                    </span>
                  </div>

                  {/* Nút hành động */}
                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={copySummary}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 px-3.5 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-slate-700 hover:text-white"
                    >
                      {copySuccess ? <CheckIcon size={14} className="text-emerald-400" /> : <CopyIcon size={14} />}
                      <span>{copySuccess ? "Đã sao chép" : "Sao chép"}</span>
                    </button>

                    <button
                      onClick={exportStudyGuideToPdf}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-rose-600 via-rose-500 to-amber-500 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-rose-500/25 transition hover:brightness-110 active:scale-[0.98]"
                    >
                      <FilePdfIcon size={14} />
                      <span>Xuất file PDF</span>
                    </button>

                    <button
                      onClick={downloadStudyGuide}
                      className="flex items-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-3.5 py-1.5 text-xs font-bold text-white shadow-md shadow-cyan-500/20 transition hover:brightness-110"
                    >
                      <DownloadIcon size={14} />
                      <span>{downloadSuccess ? "Đã tải file .md" : "Tải về (.md)"}</span>
                    </button>
                  </div>
                </div>

                {/* Văn bản Markdown */}
                <div className="prose prose-invert mt-6 max-w-none whitespace-pre-wrap font-sans text-xs leading-relaxed text-slate-200 sm:text-sm">
                  {summary}
                </div>
              </article>
            )}

            {/* Xem trước văn bản gốc đã trích xuất */}
            <details className="mt-6 rounded-2xl border border-slate-800/80 bg-slate-950/50 p-4">
              <summary className="cursor-pointer text-xs font-bold text-slate-400 hover:text-white">
                ▶ Xem nội dung văn bản gốc đã trích xuất từ tài liệu ({extractedText.length.toLocaleString()} ký tự)
              </summary>
              <div className="mt-3 max-h-60 overflow-y-auto whitespace-pre-wrap break-words rounded-xl bg-slate-950 p-3 font-mono text-[11px] leading-relaxed text-slate-400">
                {extractedText}
              </div>
            </details>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => {
                  setExtractedText("");
                  setExtractedTitle("");
                  setPageCount(0);
                  setSummary("");
                  setSummaryTitle("");
                }}
                className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-400 hover:bg-slate-800 hover:text-white"
              >
                Đóng trung tâm phân tích
              </button>
            </div>
          </section>
        )}

        {/* ======================================================== */}
        {/* DANH SÁCH TÀI LIỆU ĐÃ LƯU TRỮ */}
        {/* ======================================================== */}
        <section className="mt-12">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-bold sm:text-2xl">
                Danh sách tài liệu đã lưu
              </h2>
              <p className="text-xs text-slate-400">
                Hiển thị {filteredDocuments.length} / {documents.length} tài liệu trong kho
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
                const isText = ["txt", "md", "csv", "json"].includes(doc.file_type.toLowerCase());
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
                              : isText
                              ? "bg-cyan-500/10 text-cyan-400"
                              : "bg-blue-500/10 text-blue-400"
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
                      {/* Nút Kích Hoạt AI hiển thị cho tất cả mọi tài liệu (PDF, Word, PPT, TXT...) */}
                      <button
                        onClick={() => extractDocument(doc)}
                        disabled={isExtracting}
                        className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-purple-600/30 to-cyan-600/30 border border-purple-500/40 px-3 py-2 text-xs font-bold text-purple-200 transition hover:brightness-125 disabled:opacity-50"
                      >
                        <SparklesIcon size={14} className="text-cyan-400" />
                        <span>{isExtracting ? "Đang đọc..." : "AI Ôn tập"}</span>
                      </button>

                      <button
                        onClick={() => viewDocument(doc)}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-500/15 px-3 py-2 text-xs font-semibold text-blue-300 transition hover:bg-blue-600 hover:text-white"
                      >
                        <EyeIcon size={14} />
                        <span>Xem</span>
                      </button>

                      <button
                        onClick={() => downloadDocument(doc)}
                        disabled={isDownloading}
                        className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-500/15 px-3 py-2 text-xs font-semibold text-emerald-300 transition hover:bg-emerald-600 hover:text-white disabled:opacity-50"
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
      </div>
    </main>
  );
}

export default function DocumentsPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
        </main>
      }
    >
      <DocumentsContent />
    </Suspense>
  );
}
