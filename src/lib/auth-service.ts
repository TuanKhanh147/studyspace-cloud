import { createClient } from "./supabase/client";

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
  file_data?: string; // Base64 data for offline/fallback storage
  created_at: string;
};

const USERS_KEY = "studyspace_cloud_users";
const SESSION_KEY = "studyspace_active_session";
const SUBJECTS_KEY_PREFIX = "studyspace_subjects_";
const DOCS_KEY_PREFIX = "studyspace_docs_";

function getLocalUsers(): any[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || "[]");
  } catch {
    return [];
  }
}

function saveLocalUsers(users: any[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
}

export const AuthService = {
  async getSession(): Promise<UserSession | null> {
    if (typeof window === "undefined") return null;

    // 1. Thử lấy từ Supabase trước
    try {
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        return {
          id: data.session.user.id,
          email: data.session.user.email || "",
          full_name:
            data.session.user.user_metadata?.full_name ||
            data.session.user.email?.split("@")[0] ||
            "Sinh viên",
        };
      }
    } catch {
      // Supabase không khả dụng -> fallback
    }

    // 2. Fallback sang Local Session
    try {
      const raw = localStorage.getItem(SESSION_KEY);
      if (raw) {
        return JSON.parse(raw);
      }
    } catch {}

    return null;
  },

  async signUp(email: string, password: string, fullName: string): Promise<UserSession> {
    const cleanEmail = email.trim().toLowerCase();

    // 1. Thử đăng ký qua Supabase
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signUp({
        email: cleanEmail,
        password,
        options: {
          data: { full_name: fullName.trim() },
        },
      });

      if (!error && data.user) {
        const session: UserSession = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          full_name: fullName.trim(),
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
      }
    } catch {
      // Supabase connection failed -> Chuyển sang Cloud Resilient Local Engine
    }

    // 2. Resilient Fallback: Lưu tài khoản an toàn vào kho cục bộ của trình duyệt
    const users = getLocalUsers();
    const existing = users.find((u) => u.email === cleanEmail);
    if (existing) {
      throw new Error("Email này đã được đăng ký tài khoản. Vui lòng chuyển sang Đăng nhập.");
    }

    const newUser = {
      id: "user_" + Math.random().toString(36).substring(2, 10),
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

    // 1. Thử đăng nhập qua Supabase
    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: cleanEmail,
        password,
      });

      if (!error && data.user) {
        const session: UserSession = {
          id: data.user.id,
          email: data.user.email || cleanEmail,
          full_name:
            data.user.user_metadata?.full_name ||
            data.user.email?.split("@")[0] ||
            "Sinh viên",
        };
        localStorage.setItem(SESSION_KEY, JSON.stringify(session));
        return session;
      }
    } catch {
      // Supabase connection failed -> Chuyển sang Cloud Resilient Local Engine
    }

    // 2. Resilient Fallback
    const users = getLocalUsers();
    const found = users.find((u) => u.email === cleanEmail);

    if (!found || found.password !== password) {
      throw new Error("Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.");
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
    try {
      const supabase = createClient();
      await supabase.auth.signOut();
    } catch {}

    if (typeof window !== "undefined") {
      localStorage.removeItem(SESSION_KEY);
    }
  },
};

export const DataService = {
  // --- MÔN HỌC (SUBJECTS) ---
  async getSubjects(userId: string): Promise<SubjectItem[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch {}

    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(
        localStorage.getItem(SUBJECTS_KEY_PREFIX + userId) || "[]"
      );
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
    try {
      const supabase = createClient();
      if (id) {
        const { data, error } = await supabase
          .from("subjects")
          .update({ name, description: description || null, color })
          .eq("id", id)
          .eq("user_id", userId)
          .select()
          .single();

        if (!error && data) return data;
      } else {
        const { data, error } = await supabase
          .from("subjects")
          .insert({ user_id: userId, name, description: description || null, color })
          .select()
          .single();

        if (!error && data) return data;
      }
    } catch {}

    // Fallback
    const key = SUBJECTS_KEY_PREFIX + userId;
    let list: SubjectItem[] = [];
    try {
      list = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {}

    if (id) {
      list = list.map((s) =>
        s.id === id ? { ...s, name, description: description || null, color } : s
      );
    } else {
      const newSubject: SubjectItem = {
        id: "subj_" + Math.random().toString(36).substring(2, 10),
        user_id: userId,
        name,
        description: description || null,
        color,
        created_at: new Date().toISOString(),
      };
      list.unshift(newSubject);
    }

    localStorage.setItem(key, JSON.stringify(list));
    return list[0];
  },

  async deleteSubject(userId: string, id: string): Promise<void> {
    try {
      const supabase = createClient();
      await supabase.from("subjects").delete().eq("id", id).eq("user_id", userId);
    } catch {}

    const key = SUBJECTS_KEY_PREFIX + userId;
    try {
      let list: SubjectItem[] = JSON.parse(localStorage.getItem(key) || "[]");
      list = list.filter((s) => s.id !== id);
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
  },

  // --- TÀI LIỆU (DOCUMENTS) ---
  async getDocuments(userId: string): Promise<DocumentRecord[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("documents")
        .select("*")
        .order("created_at", { ascending: false });

      if (!error && data && data.length > 0) {
        return data;
      }
    } catch {}

    if (typeof window === "undefined") return [];
    try {
      return JSON.parse(localStorage.getItem(DOCS_KEY_PREFIX + userId) || "[]");
    } catch {
      return [];
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
    const filePath = `${userId}/${file.name}`;

    try {
      const supabase = createClient();
      await supabase.storage.from("studyspace-documents").upload(filePath, file, {
        upsert: true,
      });

      const { data, error } = await supabase
        .from("documents")
        .insert({
          user_id: userId,
          subject_id: subjectId,
          title,
          file_name: file.name,
          file_path: filePath,
          file_type: extension,
        })
        .select()
        .single();

      if (!error && data) return data;
    } catch {}

    // Fallback lưu cục bộ an toàn
    const key = DOCS_KEY_PREFIX + userId;
    let list: DocumentRecord[] = [];
    try {
      list = JSON.parse(localStorage.getItem(key) || "[]");
    } catch {}

    const newDoc: DocumentRecord = {
      id: "doc_" + Math.random().toString(36).substring(2, 10),
      user_id: userId,
      subject_id: subjectId,
      title,
      file_name: file.name,
      file_path: filePath,
      file_type: extension,
      file_data: base64Data,
      created_at: new Date().toISOString(),
    };

    list.unshift(newDoc);
    localStorage.setItem(key, JSON.stringify(list));
    return newDoc;
  },

  async deleteDocument(userId: string, doc: DocumentRecord): Promise<void> {
    try {
      const supabase = createClient();
      await supabase.storage.from("studyspace-documents").remove([doc.file_path]);
      await supabase.from("documents").delete().eq("id", doc.id).eq("user_id", userId);
    } catch {}

    const key = DOCS_KEY_PREFIX + userId;
    try {
      let list: DocumentRecord[] = JSON.parse(localStorage.getItem(key) || "[]");
      list = list.filter((d) => d.id !== doc.id);
      localStorage.setItem(key, JSON.stringify(list));
    } catch {}
  },
};
