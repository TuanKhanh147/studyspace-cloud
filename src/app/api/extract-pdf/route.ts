import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Không tìm thấy file PDF được gửi lên." },
        { status: 400 }
      );
    }

    if (
      file.type !== "application/pdf" &&
      !file.name.toLowerCase().endsWith(".pdf")
    ) {
      return NextResponse.json(
        { error: "Định dạng không hợp lệ. Chỉ chấp nhận file PDF." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "File PDF đang bị trống." },
        { status: 400 }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Dung lượng file PDF vượt quá giới hạn cho phép (25 MB)." },
        { status: 400 }
      );
    }

    // Nạp thư viện PDF.js
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

    // Chỉ định worker nếu file worker tồn tại trên ổ đĩa
    try {
      const workerPath = path.join(
        process.cwd(),
        "node_modules",
        "pdfjs-dist",
        "legacy",
        "build",
        "pdf.worker.mjs"
      );

      if (fs.existsSync(workerPath)) {
        pdfjs.GlobalWorkerOptions.workerSrc = pathToFileURL(workerPath).href;
      }
    } catch {
      // Bỏ qua lỗi cấu hình worker, thư viện sẽ tự động dùng chế độ mặc định
    }

    // Đọc dữ liệu file PDF
    const arrayBuffer = await file.arrayBuffer();
    const uint8Array = new Uint8Array(arrayBuffer);

    const loadingTask = pdfjs.getDocument({
      data: uint8Array,
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    let fullText = "";

    // Đọc tối đa 50 trang đầu để đảm bảo hiệu năng
    const maxPagesToRead = Math.min(pdf.numPages, 50);

    for (let pageNumber = 1; pageNumber <= maxPagesToRead; pageNumber++) {
      const page = await pdf.getPage(pageNumber);
      const textContent = await page.getTextContent();

      const pageText = textContent.items
        .map((item: any) => ("str" in item ? item.str : ""))
        .join(" ")
        .trim();

      if (pageText) {
        fullText += `\n\n--- Trang ${pageNumber} ---\n${pageText}`;
      }
    }

    if (!fullText.trim()) {
      return NextResponse.json(
        {
          error:
            "Không thể trích xuất văn bản từ tài liệu này. Có thể file PDF là bản scan dạng hình ảnh.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      pageCount: pdf.numPages,
      readPages: maxPagesToRead,
      text: fullText.trim(),
    });
  } catch (error) {
    console.error("PDF EXTRACTION ERROR:", error);
    return NextResponse.json(
      {
        error: "Đã xảy ra lỗi trong quá trình đọc tài liệu PDF.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
