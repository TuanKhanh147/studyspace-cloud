// StudySpace Cloud - Auth & Data Service
// Chế độ: Offline-first với IndexedDB (không phụ thuộc Supabase)
// Supabase đang bị paused → dùng localStorage cho auth, IndexedDB cho data

import {
  idbSaveDocument,
  idbGetDocuments,
  idbDeleteDocument,
  idbSaveSubject,
  idbGetSubjects,
  idbDeleteSubject,
  migrateFromLocalStorage,
} from "./indexed-db";

export type UserSession = {
  id: string;
  email: string;
  full_name: string;
};

export type SubjectItem = {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};

export type DocumentRecord = {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_data?: string; // Base64 lưu trong IndexedDB (không giới hạn)
  created_at: string;
};

const USERS_KEY = "studyspace_cloud_users";
const SESSION_KEY = "studyspace_active_session";

function getLocalUsers(): {
  id: string;
  email: string;
  password: string;
  full_name: string;
  created_at: string;
}[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalUsers(
  users: {
    id: string;
    email: string;
    password: string;
    full_name: string;
    created_at: string;
  }[]
) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

// ============================================================
// AUTH SERVICE - Dùng localStorage (không cần Supabase)
// ============================================================
export const AuthService = {
  async getSession(): Promise<UserSession | null> {
    if (typeof window === "undefined") return null;

    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        return JSON.parse(raw) as UserSession;
      }
    } catch {}

    return null;
  },

  async signUp(
    email: string,
    password: string,
    fullName: string
  ): Promise<UserSession> {
    const cleanEmail = email.trim().toLowerCase();

    if (!cleanEmail || !password || !fullName.trim()) {
      throw new Error("Vui lòng điền đầy đủ thông tin.");
    }

    if (password.length < 6) {
      throw new Error("Mật khẩu phải có ít nhất 6 ký tự.");
    }

    const users = getLocalUsers();
    const existing = users.find((u) => u.email === cleanEmail);
    if (existing) {
      throw new Error(
        "Email này đã được đăng ký. Vui lòng chuyển sang Đăng nhập."
      );
    }

    const newUser = {
      id: "user_" + Date.now().toString(36) + Math.random().toString(36).substring(2, 6),
      email: cleanEmail,
      password: password,
      full_name: fullName.trim(),
      created_at: new Date().toISOString(),
    };

    users.push(newUser);
    saveLocalUsers(users);

    const session: UserSession = {
      id: newUser.id,
      email: newUser.email,
      full_name: newUser.full_name,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  async signIn(email: string, password: string): Promise<UserSession> {
    const cleanEmail = email.trim().toLowerCase();

    const users = getLocalUsers();
    const found = users.find((u) => u.email === cleanEmail);

    if (!found || found.password !== password) {
      throw new Error(
        "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại."
      );
    }

    const session: UserSession = {
      id: found.id,
      email: found.email,
      full_name: found.full_name,
    };
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    return session;
  },

  async signOut(): Promise<void> {
    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
  },
};

// ============================================================
// DATA SERVICE - Dùng IndexedDB (không giới hạn file)
// ============================================================
export const DataService = {
  // Migrate dữ liệu cũ từ localStorage sang IndexedDB (chạy một lần)
  async migrateIfNeeded(userId: string): Promise<void> {
    try {
      await migrateFromLocalStorage(userId);
    } catch {}
  },

  // --- MÔN HỌC (SUBJECTS) ---
  async getSubjects(userId: string): Promise<SubjectItem[]> {
    // Migrate dữ liệu cũ nếu có
    await this.migrateIfNeeded(userId);

    try {
      return await idbGetSubjects(userId);
    } catch {
      return [];
    }
  },

  async saveSubject(
    userId: string,
    id: string | null,
    name: string,
    description: string,
    color: string
  ): Promise<SubjectItem> {
    if (id) {
      // Cập nhật môn học hiện có
      const list = await idbGetSubjects(userId);
      const existing = list.find((s) => s.id === id);
      if (existing) {
        const updated: SubjectItem = {
          ...existing,
          name,
          description: description || null,
          color,
        };
        await idbSaveSubject(updated);
        return updated;
      }
    }

    // Tạo môn học mới
    const newSubject: SubjectItem = {
      id:
        "subj_" +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 6),
      user_id: userId,
      name,
      description: description || null,
      color,
      created_at: new Date().toISOString(),
    };
    await idbSaveSubject(newSubject);
    return newSubject;
  },

  async deleteSubject(userId: string, id: string): Promise<void> {
    await idbDeleteSubject(id);
  },

  // --- TÀI LIỆU (DOCUMENTS) ---
  async getDocuments(userId: string): Promise<DocumentRecord[]> {
    try {
      const docs = await idbGetDocuments(userId);
      // Trả về metadata (không có file_data) để tránh load nặng
      return docs.map((doc) => ({
        ...doc,
        file_data: undefined, // Load file_data khi cần (xem/tải)
      }));
    } catch {
      return [];
    }
  },

  // Lấy tài liệu đầy đủ kèm file_data (dùng khi xem/tải về/trích xuất PDF)
  async getDocumentWithData(docId: string): Promise<DocumentRecord | null> {
    try {
      const { idbGetDocumentById } = await import("./indexed-db");
      const doc = await idbGetDocumentById(docId);
      return doc as DocumentRecord | null;
    } catch {
      return null;
    }
  },

  async saveDocument(
    userId: string,
    subjectId: string,
    title: string,
    file: File,
    base64Data?: string
  ): Promise<DocumentRecord> {
    const extension = file.name.split(".").pop()?.toLowerCase() || "file";
    const filePath = `${userId}/${Date.now()}_${file.name}`;

    const newDoc: DocumentRecord = {
      id:
        "doc_" +
        Date.now().toString(36) +
        Math.random().toString(36).substring(2, 6),
      user_id: userId,
      subject_id: subjectId,
      title,
      file_name: file.name,
      file_path: filePath,
      file_type: extension,
      file_data: base64Data, // Lưu đầy đủ Base64 vào IndexedDB (không giới hạn)
      created_at: new Date().toISOString(),
    };

    await idbSaveDocument(newDoc);
    return newDoc;
  },

  async deleteDocument(userId: string, doc: DocumentRecord): Promise<void> {
    await idbDeleteDocument(doc.id);
  },
};
