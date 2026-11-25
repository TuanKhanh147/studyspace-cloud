import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import {
  StudyMode,
  generateBuiltinStudyContent,
  callGeminiApi,
} from "@/lib/study-ai-engine";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const content = body.content;
    const docTitle = body.title || "Tài liệu học tập";
    const mode: StudyMode = body.mode || "core_focus";
    const customApiKey = typeof body.customApiKey === "string" ? body.customApiKey.trim() : "";
    const requestedProvider = body.provider || "auto"; // "auto" | "gemini" | "openai" | "builtin"

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Không tìm thấy nội dung văn bản để phân tích." },
        { status: 400 }
      );
    }

    // Nếu người dùng chọn dùng Chế độ Phân tích Tự động Cốt lõi (Built-in)
    if (requestedProvider === "builtin") {
      const summaryText = generateBuiltinStudyContent(content, docTitle, mode);
      return NextResponse.json({
        success: true,
        summary: summaryText,
        mode,
        engine: "builtin",
        modelName: "StudySpace Built-in Smart Engine",
      });
    }

    // 1. Thử gọi Google Gemini API trước (Nhanh, miễn phí nhiều, chất lượng cao)
    const geminiKey =
      (requestedProvider === "gemini" && customApiKey) ||
      (customApiKey && customApiKey.startsWith("AIza")) ||
      process.env.GEMINI_API_KEY;

    if (geminiKey) {
      try {
        const geminiResult = await callGeminiApi(
          geminiKey,
          docTitle,
          content,
          mode,
          "gemini-1.5-flash"
        );
        return NextResponse.json({
          success: true,
          summary: geminiResult,
          mode,
          engine: "gemini",
          modelName: "Google Gemini 1.5 Flash",
        });
      } catch (geminiError) {
        console.warn("Gemini API call failed, trying next option:", geminiError);
      }
    }

    // 2. Thử gọi OpenAI API
    const openaiKey =
      (requestedProvider === "openai" && customApiKey) ||
      (customApiKey && customApiKey.startsWith("sk-")) ||
      process.env.OPENAI_API_KEY;

    if (openaiKey) {
      try {
        let modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
        if (modelName === "gpt-6-astra" || !modelName) {
          modelName = "gpt-4o-mini";
        }

        const openai = new OpenAI({ apiKey: openaiKey });

        const modePrompts: Record<StudyMode, string> = {
          core_focus: `Phân tích trọng tâm bài học:
1. 🎯 TỔNG QUAN & MỤC TIÊU CỐT LÕI
2. 🔑 CÁC KHÁI NIỆM & ĐỊNH NGHĨA TRỌNG TÂM
3. 📐 NGUYÊN LÝ, CÔNG THỨC & QUY TẮC BẮT BUỘC PHẢI NHỚ
4. 💡 ĐIỂM CẦN LƯU Ý KHI LÀM BÀI THI
5. ⚡ ĐÚC KẾT NHANH TRONG 3 DÒNG`,

          study_guide: `Soạn Đề cương ôn tập toàn diện chi tiết:
1. 📚 KHUNG KIẾN THỨC BẮT BUỘC PHẢI THUỘC (từng chuyên đề, logic)
2. 🔍 BẢNG ĐỐI CHIẾU THUẬT NGỮ & KHÁI NIỆM
3. ⚠️ NHỮNG CẠM BẪY DỄ MẤT ĐIỂM TRONG PHÒNG THI
4. 🚀 KẾ HOẠCH ÔN TẬP 3 BƯỚC ĐẠT ĐIỂM TỐI ĐA`,

          practice_quiz: `Tạo Bộ câu hỏi ôn tập & trắc nghiệm:
1. 🔘 5 CÂU HỎI TRẮC NGHIỆM có 4 đáp án A, B, C, D kèm Đáp án đúng và Giải thích chi tiết
2. ✍️ 2 CÂU HỎI TỰ LUẬN TRỌNG TÂM kèm dàn ý gợi ý trả lời chuẩn để sinh viên tự luyện thi`,

          quick_flashcards: `Tạo Thẻ ghi nhớ tốc hành (Flashcards 60s):
1. 🃏 4 THẺ GHI NHỚ MẶT TRƯỚC (Câu hỏi/Thuật ngữ) và MẶT SAU (Ý nghĩa cốt lõi ngắn gọn)
2. 🎯 BỘ TỪ KHÓA BẮT BUỘC PHẢI CÓ TRONG BÀI THI
3. 💡 MẸO NHỚ NHANH 60 GIÂY TRƯỚC GIỜ THI`,
        };

        const truncatedContent =
          content.length > 50000
            ? content.slice(0, 50000) + "\n\n[...Nội dung đã được cắt bớt để tối ưu hóa...]"
            : content;

        const completion = await openai.chat.completions.create({
          model: modelName,
          messages: [
            {
              role: "system",
              content: `Bạn là Trợ lý Học tập AI cao cấp của nền tảng StudySpace dành cho sinh viên đại học.
Nhiệm vụ: ${modePrompts[mode]}
Định dạng Markdown chuyên nghiệp, dễ học, sư phạm cao.`,
            },
            {
              role: "user",
              content: `Tài liệu: "${docTitle}"\n\nNội dung chi tiết:\n${truncatedContent}`,
            },
          ],
          temperature: 0.2,
        });

        const summaryText = completion.choices[0]?.message?.content || "";

        if (summaryText.trim()) {
          return NextResponse.json({
            success: true,
            summary: summaryText,
            mode,
            engine: "openai",
            modelName,
          });
        }
      } catch (openaiError) {
        console.warn("OpenAI API call failed (e.g. quota 429), activating resilient fallback:", openaiError);
      }
    }

    // 3. Resilient Fallback: Chạy Bộ Phân tích Ngữ nghĩa Tự động Cốt lõi (Smart Built-in NLP)
    // ĐẢM BẢO CHỨC NĂNG LUÔN TRẢ VỀ KẾT QUẢ ĐẸP MẮT VÀ ĐẦY ĐỦ CHO SINH VIÊN, KHÔNG BAO GIỜ BỊ LỖI
    const fallbackText = generateBuiltinStudyContent(content, docTitle, mode);

    return NextResponse.json({
      success: true,
      summary: fallbackText,
      mode,
      engine: "builtin",
      modelName: "StudySpace Built-in Smart Engine",
      note: "Được tổng hợp bởi Bộ Phân tích Ngữ nghĩa StudySpace Smart Engine",
    });
  } catch (error) {
    console.error("AI STUDY ENGINE ERROR:", error);
    // Vẫn trả về fallback thay vì crash 500
    try {
      const body = await request.clone().json().catch(() => ({}));
      const fallback = generateBuiltinStudyContent(
        body.content || "Tài liệu",
        body.title || "Tài liệu",
        body.mode || "core_focus"
      );
      return NextResponse.json({
        success: true,
        summary: fallback,
        mode: body.mode || "core_focus",
        engine: "builtin",
        modelName: "StudySpace Built-in Smart Engine",
      });
    } catch {
      return NextResponse.json(
        {
          error: "Không thể thực hiện phân tích tài liệu.",
          details: error instanceof Error ? error.message : String(error),
        },
        { status: 500 }
      );
    }
  }
}
