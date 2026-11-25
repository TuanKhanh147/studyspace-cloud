import { NextRequest, NextResponse } from "next/server";
import path from "node:path";
import fs from "node:fs";
import { pathToFileURL } from "node:url";
import zlib from "node:zlib";

// Hàm bóc tách nội dung văn bản từ file Word (.docx) thuần túy không cần thư viện ngoài
function extractTextFromDocx(buffer: Buffer): string {
  try {
    let offset = 0;
    while (offset < buffer.length - 30) {
      if (
        buffer[offset] === 0x50 &&
        buffer[offset + 1] === 0x4b &&
        buffer[offset + 2] === 0x03 &&
        buffer[offset + 3] === 0x04
      ) {
        const compression = buffer.readUInt16LE(offset + 8);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const fileNameLen = buffer.readUInt16LE(offset + 26);
        const extraLen = buffer.readUInt16LE(offset + 28);
        const fileName = buffer.toString(
          "utf8",
          offset + 30,
          offset + 30 + fileNameLen
        );
        const dataStart = offset + 30 + fileNameLen + extraLen;

        if (fileName === "word/document.xml") {
          const compressedData = buffer.subarray(
            dataStart,
            dataStart + compressedSize
          );
          let xmlStr = "";
          if (compression === 8) {
            xmlStr = zlib.inflateRawSync(compressedData).toString("utf8");
          } else if (compression === 0) {
            xmlStr = compressedData.toString("utf8");
          }

          const text = xmlStr
            .replace(/<\/w:p>/g, "\n")
            .replace(/<w:tab\/>/g, "\t")
            .replace(/<[^>]+>/g, " ")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
            .replace(/&quot;/g, '"')
            .replace(/&apos;/g, "'")
            .replace(/[ \t]+/g, " ")
            .replace(/\n\s*\n+/g, "\n\n")
            .trim();

          return text;
        }

        offset = dataStart + compressedSize;
      } else {
        offset++;
      }
    }
  } catch (err) {
    console.warn("Lỗi bóc tách docx:", err);
  }
  return "";
}

// Hàm bóc tách nội dung từ slide PowerPoint (.pptx)
function extractTextFromPptx(buffer: Buffer): string {
  const slidesText: string[] = [];
  try {
    let offset = 0;
    while (offset < buffer.length - 30) {
      if (
        buffer[offset] === 0x50 &&
        buffer[offset + 1] === 0x4b &&
        buffer[offset + 2] === 0x03 &&
        buffer[offset + 3] === 0x04
      ) {
        const compression = buffer.readUInt16LE(offset + 8);
        const compressedSize = buffer.readUInt32LE(offset + 18);
        const fileNameLen = buffer.readUInt16LE(offset + 26);
        const extraLen = buffer.readUInt16LE(offset + 28);
        const fileName = buffer.toString(
          "utf8",
          offset + 30,
          offset + 30 + fileNameLen
        );
        const dataStart = offset + 30 + fileNameLen + extraLen;

        if (fileName.startsWith("ppt/slides/slide") && fileName.endsWith(".xml")) {
          const compressedData = buffer.subarray(
            dataStart,
            dataStart + compressedSize
          );
          let xmlStr = "";
          if (compression === 8) {
            xmlStr = zlib.inflateRawSync(compressedData).toString("utf8");
          } else if (compression === 0) {
            xmlStr = compressedData.toString("utf8");
          }

          const text = xmlStr
            .replace(/<[^>]+>/g, " ")
            .replace(/&lt;/g, "<")
            .replace(/&gt;/g, ">")
            .replace(/&amp;/g, "&")
            .replace(/[ \t]+/g, " ")
            .trim();

          if (text) slidesText.push(text);
        }

        offset = dataStart + compressedSize;
      } else {
        offset++;
      }
    }
  } catch (err) {
    console.warn("Lỗi bóc tách pptx:", err);
  }
  return slidesText.join("\n\n--- Slide ---\n");
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "Không tìm thấy file tài liệu được gửi lên." },
        { status: 400 }
      );
    }

    if (file.size === 0) {
      return NextResponse.json(
        { error: "File tài liệu đang bị trống." },
        { status: 400 }
      );
    }

    if (file.size > 25 * 1024 * 1024) {
      return NextResponse.json(
        { error: "Dung lượng file vượt quá giới hạn cho phép (25 MB)." },
        { status: 400 }
      );
    }

    const fileName = file.name.toLowerCase();
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // 1. Nếu là file Word (.docx)
    if (fileName.endsWith(".docx")) {
      const docxText = extractTextFromDocx(buffer);
      if (docxText.trim()) {
        return NextResponse.json({
          success: true,
          pageCount: Math.max(1, Math.ceil(docxText.length / 1800)),
          text: docxText,
          format: "docx",
        });
      }
    }

    // 2. Nếu là file PowerPoint (.pptx)
    if (fileName.endsWith(".pptx")) {
      const pptxText = extractTextFromPptx(buffer);
      if (pptxText.trim()) {
        return NextResponse.json({
          success: true,
          pageCount: Math.max(1, Math.ceil(pptxText.length / 1200)),
          text: pptxText,
          format: "pptx",
        });
      }
    }

    // 3. Nếu là file văn bản thuần túy (.txt, .md, .csv, .json)
    if (
      fileName.endsWith(".txt") ||
      fileName.endsWith(".md") ||
      fileName.endsWith(".csv") ||
      fileName.endsWith(".json")
    ) {
      const text = buffer.toString("utf8");
      return NextResponse.json({
        success: true,
        pageCount: 1,
        text: text.trim(),
        format: "text",
      });
    }

    // 4. Mặc định xử lý PDF với pdfjs-dist
    const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

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
    } catch {}

    const loadingTask = pdfjs.getDocument({
      data: new Uint8Array(arrayBuffer),
      useSystemFonts: true,
      disableFontFace: true,
    });

    const pdf = await loadingTask.promise;
    let fullText = "";
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
            "Không thể trích xuất văn bản từ tài liệu này. Có thể file là bản scan dạng ảnh.",
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      success: true,
      pageCount: pdf.numPages,
      readPages: maxPagesToRead,
      text: fullText.trim(),
      format: "pdf",
    });
  } catch (error) {
    console.error("DOCUMENT EXTRACTION ERROR:", error);
    return NextResponse.json(
      {
        error: "Đã xảy ra lỗi trong quá trình đọc tài liệu.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
