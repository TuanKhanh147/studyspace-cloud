// IndexedDB wrapper for StudySpace Cloud
// Dùng thay thế localStorage để lưu file không giới hạn (hỗ trợ 50MB-1GB)

const DB_NAME = "studyspace-db";
const DB_VERSION = 1;
const DOCS_STORE = "documents";
const SUBJECTS_STORE = "subjects";

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof window === "undefined") {
      reject(new Error("IndexedDB không khả dụng trên server"));
      return;
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      if (!db.objectStoreNames.contains(DOCS_STORE)) {
        const docStore = db.createObjectStore(DOCS_STORE, { keyPath: "id" });
        docStore.createIndex("user_id", "user_id", { unique: false });
        docStore.createIndex("subject_id", "subject_id", { unique: false });
      }

      if (!db.objectStoreNames.contains(SUBJECTS_STORE)) {
        const subjStore = db.createObjectStore(SUBJECTS_STORE, {
          keyPath: "id",
        });
        subjStore.createIndex("user_id", "user_id", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

// ============ DOCUMENTS ============

export async function idbSaveDocument(doc: {
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_data?: string;
  created_at: string;
}): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, "readwrite");
    const store = tx.objectStore(DOCS_STORE);
    const req = store.put(doc);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetDocuments(userId: string): Promise<
  {
    id: string;
    user_id: string;
    subject_id: string;
    title: string;
    file_name: string;
    file_path: string;
    file_type: string;
    file_data?: string;
    created_at: string;
  }[]
> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, "readonly");
    const store = tx.objectStore(DOCS_STORE);
    const index = store.index("user_id");
    const req = index.getAll(userId);

    req.onsuccess = () => {
      const results = req.result || [];
      // Sắp xếp mới nhất trước
      results.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetDocumentById(docId: string): Promise<{
  id: string;
  user_id: string;
  subject_id: string;
  title: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_data?: string;
  created_at: string;
} | null> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, "readonly");
    const store = tx.objectStore(DOCS_STORE);
    const req = store.get(docId);
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
}

export async function idbDeleteDocument(docId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(DOCS_STORE, "readwrite");
    const store = tx.objectStore(DOCS_STORE);
    const req = store.delete(docId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// ============ SUBJECTS ============

export async function idbSaveSubject(subject: {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
}): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBJECTS_STORE, "readwrite");
    const store = tx.objectStore(SUBJECTS_STORE);
    const req = store.put(subject);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

export async function idbGetSubjects(userId: string): Promise<
  {
    id: string;
    user_id: string;
    name: string;
    description: string | null;
    color: string;
    created_at: string;
  }[]
> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBJECTS_STORE, "readonly");
    const store = tx.objectStore(SUBJECTS_STORE);
    const index = store.index("user_id");
    const req = index.getAll(userId);

    req.onsuccess = () => {
      const results = req.result || [];
      results.sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      resolve(results);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function idbDeleteSubject(subjectId: string): Promise<void> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(SUBJECTS_STORE, "readwrite");
    const store = tx.objectStore(SUBJECTS_STORE);
    const req = store.delete(subjectId);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
}

// Migrate dữ liệu cũ từ localStorage sang IndexedDB
export async function migrateFromLocalStorage(userId: string): Promise<void> {
  if (typeof window === "undefined") return;

  const DOCS_KEY = "studyspace_docs_" + userId;
  const SUBJECTS_KEY = "studyspace_subjects_" + userId;

  try {
    const docsRaw = localStorage.getItem(DOCS_KEY);
    if (docsRaw) {
      const docs = JSON.parse(docsRaw);
      for (const doc of docs) {
        await idbSaveDocument(doc);
      }
      // Xóa khỏi localStorage sau khi migrate để giải phóng quota
      localStorage.removeItem(DOCS_KEY);
    }
  } catch {
    // ignore migrate errors
  }

  try {
    const subjRaw = localStorage.getItem(SUBJECTS_KEY);
    if (subjRaw) {
      const subjects = JSON.parse(subjRaw);
      for (const subject of subjects) {
        await idbSaveSubject(subject);
      }
      localStorage.removeItem(SUBJECTS_KEY);
    }
  } catch {
    // ignore migrate errors
  }
}
