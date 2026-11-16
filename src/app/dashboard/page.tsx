"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

type Subject = {
  id: string;
  name: string;
  description: string | null;
  color: string;
  created_at: string;
};

type DocumentMeta = {
  id: string;
  subject_id: string;
  title: string;
  file_name: string;
};

export default function Dashboard() {
  const router = useRouter();
  const supabase = createClient();

  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [documents, setDocuments] = useState<DocumentMeta[]>([]);
  const [userEmail, setUserEmail] = useState("");
  const [userName, setUserName] = useState("");
  const [userId, setUserId] = useState("");

  const [searchQuery, setSearchQuery] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [color, setColor] = useState("#2563eb");

  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Tải danh sách môn học và tài liệu của người dùng
  async function loadData(uid: string) {
    try {
      const [subjRes, docRes] = await Promise.all([
        supabase
          .from("subjects")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("documents")
          .select("id, subject_id, title, file_name"),
      ]);

      if (subjRes.error) {
        setError(subjRes.error.message);
      } else {
        setSubjects(subjRes.data ?? []);
      }

      if (!docRes.error && docRes.data) {
        setDocuments(docRes.data);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Lỗi khi tải dữ liệu.");
    }
  }

  useEffect(() => {
    async function initialize() {
      const { data, error: userError } = await supabase.auth.getUser();

      if (userError || !data?.user) {
        router.replace("/");
        return;
      }

      const user = data.user;
      setUserId(user.id);
      setUserEmail(user.email ?? "");
      setUserName(
        user.user_metadata?.full_name ||
          user.email?.split("@")[0] ||
          "Sinh viên"
      );

      await loadData(user.id);
      setLoading(false);
    }

    initialize();
  }, [router, supabase]);

  async function saveSubject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();

    if (!name.trim()) {
      setError("Vui lòng nhập tên môn học.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      if (editingId) {
        const { error: updateError } = await supabase
          .from("subjects")
          .update({
            name: name.trim(),
            description: description.trim() || null,
            color,
          })
          .eq("id", editingId)
          .eq("user_id", userId);

        if (updateError) throw updateError;

        setEditingId(null);
      } else {
        const { error: insertError } = await supabase.from("subjects").insert({
          user_id: userId,
          name: name.trim(),
          description: description.trim() || null,
          color,
        });

        if (insertError) throw insertError;
      }

      setName("");
      setDescription("");
      setColor("#2563eb");
      await loadData(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể lưu môn học.");
    } finally {
      setSaving(false);
    }
  }

  function editSubject(subject: Subject) {
    setEditingId(subject.id);
    setName(subject.name);
    setDescription(subject.description ?? "");
    setColor(subject.color);
    setError("");
    window.scrollTo({ top: 300, behavior: "smooth" });
  }

  async function deleteSubject(subject: Subject) {
    const docCountForSubject = documents.filter(
      (d) => d.subject_id === subject.id
    ).length;

    const confirmMsg =
      docCountForSubject > 0
        ? `Môn "${subject.name}" hiện có ${docCountForSubject} tài liệu. Bạn có chắc muốn xóa môn học này không?`
        : `Bạn có chắc muốn xóa môn học "${subject.name}" không?`;

    const confirmed = window.confirm(confirmMsg);
    if (!confirmed) return;

    try {
      const { error: delError } = await supabase
        .from("subjects")
        .delete()
        .eq("id", subject.id)
        .eq("user_id", userId);

      if (delError) throw delError;

      if (editingId === subject.id) {
        cancelEdit();
      }

      await loadData(userId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Không thể xóa môn học.");
    }
  }

  async function logout() {
    await supabase.auth.signOut();
    router.replace("/");
    router.refresh();
  }

  function cancelEdit() {
    setEditingId(null);
    setName("");
    setDescription("");
    setColor("#2563eb");
    setError("");
  }

  // Lọc môn học theo từ khóa tìm kiếm
  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.toLowerCase().trim();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [subjects, searchQuery]);

  // Đếm số tài liệu theo môn học
  const docsCountBySubject = useMemo(() => {
    const map: Record<string, number> = {};
    for (const doc of documents) {
      map[doc.subject_id] = (map[doc.subject_id] || 0) + 1;
    }
    return map;
  }, [documents]);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Đang tải không gian học tập...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <header className="sticky top-0 z-20 border-b border-slate-800 bg-slate-900/90 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-600 font-bold text-white shadow-md shadow-blue-600/30">
              🎓
            </span>
            <div>
              <h1 className="text-2xl font-black tracking-tight">
                Study<span className="text-blue-400">Space.</span>
              </h1>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">
                Cloud Learning Workspace
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2 rounded-xl bg-slate-800/80 px-3 py-1.5 text-xs">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-blue-500/20 font-bold text-blue-300">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden sm:block text-left">
                <p className="font-semibold text-slate-200">{userName}</p>
                <p className="text-[11px] text-slate-400">{userEmail}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500 hover:text-white sm:text-sm"
            >
              Đăng xuất
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Banner Chào Mừng & Hành Động Nhanh */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800 bg-gradient-to-r from-blue-900/40 via-indigo-900/20 to-slate-900 p-6 sm:p-8">
          <div className="relative z-10 max-w-3xl">
            <span className="inline-block rounded-full bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-400">
              Bảng điều khiển cá nhân
            </span>
            <h2 className="mt-2 text-2xl font-extrabold sm:text-3xl">
              Xin chào, {userName}! 👋
            </h2>
            <p className="mt-2 text-sm leading-relaxed text-slate-300">
              Chào mừng bạn đến với StudySpace. Tổ chức môn học, lưu trữ tài liệu sinh viên và khai thác sức mạnh AI để tóm tắt kiến thức ôn tập hiệu quả.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/dashboard/documents")}
                className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-blue-600/30 transition hover:bg-blue-500"
              >
                <span>📁</span>
                <span>Quản lý & Tải tài liệu sinh viên</span>
              </button>
            </div>
          </div>
        </section>

        {/* Thống kê Tổng quan */}
        <section className="mt-8 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Môn học đã tạo</span>
              <span className="text-xl">📚</span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-blue-400">
              {subjects.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">Các môn học trong học kỳ này</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">Tài liệu đã lưu</span>
              <span className="text-xl">📄</span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-emerald-400">
              {documents.length}
            </p>
            <p className="mt-1 text-xs text-slate-400">PDF, Slide, Word đã tải lên</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-5">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-semibold uppercase">AI Hỗ trợ</span>
              <span className="text-xl">✨</span>
            </div>
            <p className="mt-3 text-3xl font-extrabold text-purple-400">
              Sẵn sàng
            </p>
            <p className="mt-1 text-xs text-slate-400">Tóm tắt & trích xuất ý chính</p>
          </div>
        </section>

        {/* Form Thêm / Chỉnh Sửa Môn Học */}
        <section className="mt-8 rounded-2xl border border-slate-800 bg-slate-900 p-6">
          <div className="flex items-center gap-2">
            <span className="text-xl">{editingId ? "✏️" : "➕"}</span>
            <h3 className="text-lg font-bold sm:text-xl">
              {editingId ? "Chỉnh sửa thông tin môn học" : "Thêm môn học mới"}
            </h3>
          </div>

          <form onSubmit={saveSubject} className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Tên môn học *
              </label>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Cơ sở dữ liệu, Lập trình Web..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Màu sắc nhận diện
              </label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="h-11 w-20 cursor-pointer rounded-xl border border-slate-700 bg-slate-800 p-1"
                />
                <span className="text-xs text-slate-400">
                  Chọn màu để phân loại môn học trên dashboard
                </span>
              </div>
            </div>

            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Mô tả / Ghi chú môn học (tùy chọn)
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Nhập tên giảng viên, phòng học, lịch thi hoặc lưu ý..."
                rows={2}
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 md:col-span-2">
                ⚠️ {error}
              </div>
            )}

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
              >
                {saving
                  ? "Đang lưu..."
                  : editingId
                    ? "Cập nhật môn học"
                    : "Thêm môn học"}
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-xl bg-slate-800 px-5 py-3 text-sm font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Hủy bỏ
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Danh Sách Môn Học Của Sinh Viên */}
        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold sm:text-2xl">Môn học của tôi</h3>
              <p className="text-xs text-slate-400">
                Tổng cộng {subjects.length} môn học trong danh sách
              </p>
            </div>

            {subjects.length > 0 && (
              <div className="w-full sm:w-72">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="🔍 Tìm kiếm môn học..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500"
                />
              </div>
            )}
          </div>

          {subjects.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-12 text-center">
              <div className="text-5xl">📚</div>
              <p className="mt-4 text-base font-bold text-slate-200">
                Bạn chưa thêm môn học nào
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Hãy dùng form ở trên để thêm các môn học bạn đang học trong kỳ này nhé!
              </p>
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-slate-400 text-sm">
              Không tìm thấy môn học nào khớp với từ khóa &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSubjects.map((subject) => {
                const count = docsCountBySubject[subject.id] || 0;
                return (
                  <article
                    key={subject.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900 p-5 transition hover:border-slate-700 hover:shadow-xl"
                  >
                    <div>
                      {/* Vạch màu môn học */}
                      <div
                        className="mb-4 h-1.5 w-14 rounded-full"
                        style={{ backgroundColor: subject.color }}
                      />

                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-lg font-bold text-white group-hover:text-blue-300 transition">
                          {subject.name}
                        </h4>
                        <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-0.5 text-[11px] font-semibold text-slate-300">
                          📄 {count} tài liệu
                        </span>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-slate-400 line-clamp-3">
                        {subject.description || "Chưa có ghi chú mô tả cho môn học này."}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800/80">
                      {/* Nút xem tài liệu của môn */}
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/documents?subjectId=${subject.id}`
                          )
                        }
                        className="w-full rounded-xl bg-blue-600/10 py-2.5 text-xs font-bold text-blue-400 transition hover:bg-blue-600 hover:text-white"
                      >
                        📂 Xem tài liệu ({count})
                      </button>

                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => editSubject(subject)}
                          className="flex-1 rounded-lg bg-slate-800 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => deleteSubject(subject)}
                          className="flex-1 rounded-lg bg-red-500/10 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500 hover:text-white"
                        >
                          Xóa
                        </button>
                      </div>
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
