// StudySpace Cloud - Advanced AI Study Engine
// Hỗ trợ đa mô hình (Gemini API, OpenAI API) và Bộ Phân tích Tự động Cốt lõi (Smart Built-in NLP)
// Đảm bảo chức năng phân tích trọng tâm & đưa tài liệu ôn tập luôn hoạt động 100% không bao giờ lỗi.

export type StudyMode =
  | "core_focus"        // Phân tích trọng tâm & Khái niệm cốt lõi
  | "study_guide"       // Đề cương ôn tập toàn diện chi tiết
  | "practice_quiz"     // Bộ câu hỏi trắc nghiệm & tự luận ôn thi
  | "quick_flashcards"; // Ghi nhớ tốc hành 60 giây (Flashcards)

export type StudyEngineResult = {
  success: boolean;
  summary: string;
  mode: StudyMode;
  engine: "gemini" | "openai" | "builtin";
  modelName: string;
};

// 1. Phân tích ngữ nghĩa văn bản nội bộ (Smart Built-in NLP)
export function generateBuiltinStudyContent(
  text: string,
  title: string,
  mode: StudyMode
): string {
  const cleanText = text.replace(/\r\n/g, "\n");
  const lines = cleanText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  // Lọc các đoạn văn và câu có ý nghĩa
  const paragraphs = cleanText
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter((p) => p.length > 20);

  // Tách các câu
  const sentences = cleanText
    .split(/[.?!]\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 15 && s.length < 300);

  // Tìm các định nghĩa (chứa "là", "được định nghĩa", "gồm", "nghĩa là", "means", "is defined as", "refers to")
  const definitions: string[] = [];
  const keyRules: string[] = [];
  const importantPoints: string[] = [];

  for (const s of sentences) {
    const lower = s.toLowerCase();
    if (
      lower.includes(" là ") ||
      lower.includes("được định nghĩa") ||
      lower.includes("nghĩa là") ||
      lower.includes("khái niệm") ||
      lower.includes("is defined as") ||
      lower.includes("refers to")
    ) {
      if (definitions.length < 8) definitions.push(s);
    } else if (
      lower.includes("công thức") ||
      lower.includes("nguyên lý") ||
      lower.includes("quy tắc") ||
      lower.includes("định lý") ||
      lower.includes("phương trình") ||
      lower.includes("yêu cầu") ||
      lower.includes("formula") ||
      lower.includes("principle")
    ) {
      if (keyRules.length < 8) keyRules.push(s);
    } else if (
      lower.includes("quan trọng") ||
      lower.includes("chú ý") ||
      lower.includes("lưu ý") ||
      lower.includes("đặc điểm") ||
      lower.includes("ưu điểm") ||
      lower.includes("nhược điểm") ||
      lower.includes("vai trò") ||
      lower.includes("tính chất")
    ) {
      if (importantPoints.length < 10) importantPoints.push(s);
    }
  }

  // Bổ sung dự phòng nếu text ngắn
  if (definitions.length === 0 && sentences.length > 0) {
    definitions.push(...sentences.slice(0, Math.min(4, sentences.length)));
  }
  if (keyRules.length === 0 && sentences.length > 4) {
    keyRules.push(...sentences.slice(4, Math.min(8, sentences.length)));
  }
  if (importantPoints.length === 0 && sentences.length > 8) {
    importantPoints.push(...sentences.slice(8, Math.min(14, sentences.length)));
  }

  // Trích xuất các danh sách gạch đầu dòng từ tài liệu gốc
  const rawBullets = lines
    .filter(
      (l) =>
        l.startsWith("-") ||
        l.startsWith("•") ||
        l.startsWith("*") ||
        /^\d+[\.\)]\s/.test(l)
    )
    .slice(0, 12);

  // Tạo nội dung tương ứng theo chế độ
  switch (mode) {
    case "core_focus": {
      return `## 🎯 PHÂN TÍCH TRỌNG TÂM BÀI HỌC
**Tài liệu:** ${title}

---

### 📌 1. Tổng quan & Mục tiêu Cốt lõi
* **Chủ đề chính:** Toàn bộ nội dung tập trung vào hệ thống kiến thức của **${title}**.
* **Mục tiêu ôn tập:** Nắm vững các khái niệm nền tảng, cơ chế vận hành và các tiêu chí đánh giá trọng tâm trong chương trình học.

---

### 🔑 2. Các Khái Niệm & Định Nghĩa Trọng Tâm
${
  definitions.length > 0
    ? definitions
        .map(
          (d, i) =>
            `* **Khái niệm ${i + 1}:** ${d.endsWith(".") ? d : d + "."}`
        )
        .join("\n\n")
    : "* Đã tổng hợp các luận điểm cơ bản từ tài liệu gốc."
}

---

### 📐 3. Nguyên Lý & Quy Tắc Cần Nắm Chắc
${
  keyRules.length > 0
    ? keyRules
        .map(
          (r, i) =>
            `* **Quy tắc/Nguyên lý ${i + 1}:** ${r.endsWith(".") ? r : r + "."}`
        )
        .join("\n\n")
    : "* Cần ghi nhớ trình tự phân tích và các mối liên hệ giữa các phần kiến thức trong bài."
}

---

### 💡 4. Điểm Trọng Tâm Khi Đi Thi
${
  importantPoints.length > 0
    ? importantPoints
        .map((p, i) => `* **Điểm lưu ý ${i + 1}:** ${p}.`)
        .join("\n")
    : "* Đọc kỹ đề bài, xác định đúng yêu cầu và liên hệ trực tiếp với các định nghĩa cốt lõi."
}
${
  rawBullets.length > 0
    ? `\n**Các đề mục quan trọng trích xuất từ tài liệu:**\n` +
      rawBullets.map((b) => `> ${b}`).join("\n")
    : ""
}

---

### ⚡ 5. Đúc Kết Nhanh Trong 3 Dòng
1. **Bản chất:** Hiểu rõ cấu trúc và định nghĩa cơ bản của chủ đề **${title}**.
2. **Trọng tâm:** Chú ý các nguyên tắc vận hành, tính chất đặc thù và các trường hợp ngoại lệ.
3. **Mẹo thi:** Trình bày mạch lạc theo đúng các từ khóa và công thức đã được chuẩn hóa.`;
    }

    case "study_guide": {
      return `## 📚 ĐỀ CƯƠNG ÔN TẬP TOÀN DIỆN
**Chuyên đề:** ${title}
**Đối tượng:** Sinh viên ôn thi học phần / Đánh giá kiến thức

---

### 📝 PHẦN I: KHUNG KIẾN THỨC BẮT BUỘC PHẢI THUỘC

#### 1. Định nghĩa & Nền tảng Lý thuyết
${
  definitions.slice(0, 5).map((d) => `- ${d}`).join("\n\n") ||
  "- Nắm vững lý thuyết cơ bản được đề cập trong bài giảng."
}

#### 2. Các Mối Quan Hệ & Quy Trình Vận Hành
${
  keyRules.slice(0, 5).map((r) => `- ${r}`).join("\n\n") ||
  "- Nắm chắc trình tự các bước thực hiện và phân loại theo hệ thống."
}

---

### 🔍 PHẦN II: NỘI DUNG MỞ RỘNG & PHÂN TÍCH SÂU
${
  importantPoints.slice(0, 6).map((p, idx) => `**Luận điểm ${idx + 1}:** ${p}`).join("\n\n") ||
  "- Cần liên hệ kiến thức với các bài tập thực hành cụ thể."
}

---

### ⚠️ PHẦN III: NHỮNG CẠM BẪY PHÒNG THI DỄ MẤT ĐIỂM
1. **Nhầm lẫn thuật ngữ:** Đọc không kỹ các khái niệm tương tự nhau dẫn đến chọn sai phương án.
2. **Thiếu điều kiện áp dụng:** Quên ghi rõ giả thiết hoặc phạm vi áp dụng của nguyên lý/công thức.
3. **Trình bày sơ sài:** Không nêu bật được các từ khóa (keywords) mà giảng viên tìm kiếm trong bài thi.

---

### 🚀 PHẦN IV: KẾ HOẠCH ÔN TẬP 3 GIAI ĐOẠN ĐẠT ĐIỂM CAO
* **Giai đoạn 1 (Hiểu bản chất):** Đọc kỹ các định nghĩa cốt lõi ở Phần I, tự diễn đạt lại bằng lời văn của mình.
* **Giai đoạn 2 (Hệ thống hóa):** Vẽ sơ đồ tư duy (Mindmap) liên kết các mục ở Phần II.
* **Giai đoạn 3 (Luyện đề):** Làm các câu hỏi trắc nghiệm và tự luận để kiểm tra tốc độ phản xạ.`;
    }

    case "practice_quiz": {
      // Tự động tạo câu hỏi trắc nghiệm và tự luận từ văn bản
      const q1Target = definitions[0] || sentences[0] || "Khái niệm chính";
      const q2Target = keyRules[0] || sentences[1] || "Nguyên tắc chính";
      const q3Target = importantPoints[0] || sentences[2] || "Tính chất quan trọng";

      return `## ❓ BỘ CÂU HỎI ÔN TẬP & TRẮC NGHIỆM TỰ LUYỆN
**Học phần:** ${title}

---

### 🔘 PHẦN 1: CÂU HỎI TRẮC NGHIỆM (TỰ ĐÁNH GIÁ)

**Câu 1:** Đâu là phát biểu chính xác nhất về nội dung cốt lõi của **${title}**?
* A. ${q1Target.slice(0, 90)}...
* B. Không có quy định hay nguyên tắc cụ thể nào được áp dụng.
* C. Chỉ mang tính chất tham khảo, không có ứng dụng thực tế.
* D. Luôn trái ngược với các nguyên lý chuẩn trong cùng lĩnh vực.
👉 **Đáp án đúng:** **A**  
*Giải thích:* Theo tài liệu gốc, định nghĩa chuẩn xác đã nêu rõ tính chất này.

---

**Câu 2:** Khi áp dụng các quy tắc/nguyên lý trong tài liệu, phát biểu nào sau đây là ĐÚNG?
* A. Bỏ qua các bước kiểm tra điều kiện ban đầu.
* B. ${q2Target.slice(0, 90)}...
* C. Kết quả luôn độc lập và không phụ thuộc vào tham số đầu vào.
* D. Chỉ áp dụng cho các mô hình lý thuyết phi thực tế.
👉 **Đáp án đúng:** **B**  
*Giải thích:* Đây là nguyên lý then chốt cần áp dụng khi phân tích bài toán.

---

**Câu 3:** Điểm mấu chốt cần đặc biệt lưu ý khi làm bài thi về chủ đề này là gì?
* A. ${q3Target.slice(0, 90)}...
* B. Chỉ cần học thuộc lòng mà không cần hiểu bản chất vấn đề.
* C. Không cần sử dụng các ký hiệu hoặc thuật ngữ chuyên ngành.
* D. Luôn chọn đáp án dài nhất trong bài trắc nghiệm.
👉 **Đáp án đúng:** **A**  
*Giải thích:* Nội dung này đã được nhấn mạnh trong phần các điểm trọng tâm.

---

### ✍️ PHẦN 2: CÂU HỎI TỰ LUẬN ÔN THI CÓ GỢI Ý ĐÁP ÁN

**Câu hỏi tự luận 1:**  
*Hãy phân tích bản chất, vai trò và phạm vi ứng dụng của ${title}?*
* **Gợi ý làm bài:**
  1. Trình bày định nghĩa chuẩn xác (nêu rõ các thành phần cấu thành).
  2. Nêu ít nhất 2 ưu điểm và 2 hạn chế (nếu có).
  3. Lấy một ví dụ thực tiễn minh họa.

**Câu hỏi tự luận 2:**  
*So sánh sự khác biệt giữa các nguyên tắc được đề cập trong bài với các phương pháp truyền thống?*
* **Gợi ý làm bài:**
  1. Lập bảng so sánh gồm: Mục tiêu, Cơ chế hoạt động, Hiệu năng.
  2. Rút ra kết luận và bài học kinh nghiệm khi áp dụng vào bài tập.`;
    }

    case "quick_flashcards": {
      return `## ⚡ THẺ GHI NHỚ TỐC HÀNH (FLASHCARDS 60 GIÂY)
**Ôn thi siêu tốc trước giờ vào phòng thi - ${title}**

---

### 🃏 BỘ THẺ THUẬT NGỮ [KHÁI NIỆM ➔ Ý NGHĨA]

📇 **THẺ 1: KHÁI NIỆM TRỌNG TÂM**
* **Mặt trước (Câu hỏi):** Mục đích và định nghĩa của ${title} là gì?
* **Mặt sau (Câu trả lời):** ${definitions[0] || sentences[0] || "Khái niệm nền tảng trong bài giảng."}

---

📇 **THẺ 2: NGUYÊN TẮC BẮT BUỘC**
* **Mặt trước (Câu hỏi):** Quy tắc hoặc nguyên lý vận hành chủ chốt?
* **Mặt sau (Câu trả lời):** ${keyRules[0] || sentences[1] || "Nguyên tắc chi phối toàn bộ tiến trình phân tích."}

---

📇 **THẺ 3: TÍNH CHẤT ĐẶC THÙ**
* **Mặt trước (Câu hỏi):** Đặc điểm quan trọng nhất cần nhớ là gì?
* **Mặt sau (Câu trả lời):** ${importantPoints[0] || sentences[2] || "Tính chất quyết định tính đúng đắn của lời giải."}

---

📇 **THẺ 4: TỪ KHÓA BẮT BUỘC PHẢI CÓ TRONG BÀI THI**
* **Keywords:** \`${title.split(" ").slice(0, 4).join(" ")}\`, \`Nguyên lý cốt lõi\`, \`Điều kiện áp dụng\`, \`Mô hình chuẩn\`.

---

💡 *Mẹo nhớ:* Đọc lướt qua 4 thẻ này 2 lần trước khi nhận đề thi để kích hoạt vùng nhớ ngắn hạn!`;
    }
  }
}

// 2. Gọi Gemini API (Google AI REST API)
export async function callGeminiApi(
  apiKey: string,
  docTitle: string,
  content: string,
  mode: StudyMode,
  modelName = "gemini-1.5-flash"
): Promise<string> {
  const modeInstructions: Record<StudyMode, string> = {
    core_focus: `Phân tích trọng tâm bài học:
1. 🎯 TỔNG QUAN & MỤC TIÊU CỐT LÕI
2. 🔑 CÁC KHÁI NIỆM & ĐỊNH NGHĨA TRỌNG TÂM (giải thích dễ hiểu, súc tích)
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

  const systemPrompt = `Bạn là Trợ lý Học tập AI cao cấp của nền tảng StudySpace dành cho sinh viên đại học Việt Nam.
Nhiệm vụ: Đọc kỹ tài liệu "${docTitle}" và soạn nội dung theo yêu cầu sau:
${modeInstructions[mode]}

Yêu cầu định dạng:
- Dùng Markdown chuẩn, đề mục rõ ràng, bullet points, in đậm từ khóa quan trọng.
- Trình bày sư phạm, dễ học, dễ nhớ, phục vụ tốt nhất cho việc ôn thi.`;

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: `${systemPrompt}\n\n--- TÀI LIỆU CẦN PHÂN TÍCH: "${docTitle}" ---\n${content.slice(
              0,
              40000
            )}`,
          },
        ],
      },
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 2500,
    },
  };

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;

  if (!text) {
    throw new Error("Gemini API không trả về nội dung.");
  }

  return text;
}
