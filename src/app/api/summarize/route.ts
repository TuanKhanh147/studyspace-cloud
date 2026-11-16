import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.OPENAI_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        { error: "Hệ thống chưa cấu hình OPENAI_API_KEY trong .env.local." },
        { status: 500 }
      );
    }

    const body = await request.json();
    const content = body.content;
    const docTitle = body.title || "Tài liệu học tập";

    if (typeof content !== "string" || !content.trim()) {
      return NextResponse.json(
        { error: "Không tìm thấy nội dung văn bản để tóm tắt." },
        { status: 400 }
      );
    }

    // Giới hạn độ dài đầu vào an toàn (khoảng 50.000 ký tự)
    const truncatedContent =
      content.length > 50000 ? content.slice(0, 50000) + "\n\n[...Nội dung đã được cắt bớt để tối ưu hóa tóm tắt...]" : content;

    const openai = new OpenAI({
      apiKey,
    });

    // Xử lý model: Nếu model trong env là gpt-6-astra (không tồn tại trong OpenAI), fallback về gpt-4o-mini
    let modelName = process.env.OPENAI_MODEL || "gpt-4o-mini";
    if (modelName === "gpt-6-astra" || !modelName) {
      modelName = "gpt-4o-mini";
    }

    const systemPrompt = `Bạn là Trợ lý Học tập AI cao cấp của nền tảng StudySpace dành cho sinh viên đại học.
Nhiệm vụ của bạn:
1. Đọc và phân tích tài liệu được cung cấp.
2. Tạo ra một bản tóm tắt học tập bằng tiếng Việt thật cấu trúc, dễ nhớ, phục vụ tốt cho việc ôn thi.
3. Nội dung bao gồm:
   - 📌 TỔNG QUAN CHỦ ĐỀ: Mục tiêu chính của tài liệu.
   - 🔑 CÁC KHÁI NIỆM & ĐỊNH NGHĨA TRỌNG TÂM: Giải thích ngắn gọn, súc tích.
   - 📐 CÔNG THỨC / QUY TẮC / NGUYÊN LÝ QUAN TRỌNG (nếu có trong bài).
   - 💡 ĐIỂM CẦN LƯU Ý KHI LÀM BÀI / ÔN THI: Những câu hỏi hay gặp hoặc cạm bẫy cần tránh.
   - 📝 TỔNG KẾT NHANH TRONG 3 DÒNG: Đúc kết tinh gọn.
4. Định dạng Markdown rõ ràng, dùng bullet points, in đậm từ khóa quan trọng. Không bịa đặt thông tin ngoài tài liệu.`;

    let summaryText = "";

    try {
      // Cách 1: Sử dụng Chat Completions chuẩn
      const completion = await openai.chat.completions.create({
        model: modelName,
        messages: [
          { role: "system", content: systemPrompt },
          {
            role: "user",
            content: `Hãy phân tích và tóm tắt tài liệu: "${docTitle}"\n\nNội dung chi tiết:\n${truncatedContent}`,
          },
        ],
        temperature: 0.3,
      });

      summaryText = completion.choices[0]?.message?.content || "";
    } catch (chatError) {
      console.warn("Chat completion fallback, attempting responses API:", chatError);

      // Cách 2: Nếu có Responses API (OpenAI Responses SDK)
      if (typeof (openai as any).responses?.create === "function") {
        const response = await (openai as any).responses.create({
          model: modelName,
          instructions: systemPrompt,
          input: `Hãy tóm tắt tài liệu "${docTitle}":\n\n${truncatedContent}`,
        });
        summaryText = response.output_text || "";
      } else {
        throw chatError;
      }
    }

    if (!summaryText.trim()) {
      return NextResponse.json(
        { error: "Mô hình AI không trả về nội dung tóm tắt hợp lệ." },
        { status: 502 }
      );
    }

    return NextResponse.json({
      success: true,
      summary: summaryText,
      model: modelName,
    });
  } catch (error) {
    console.error("AI SUMMARY ERROR:", error);
    return NextResponse.json(
      {
        error: "Không thể thực hiện tóm tắt tài liệu bằng AI.",
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
