"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LogoIcon,
  BookOpenIcon,
  FileTextIcon,
  SparklesIcon,
  PlusIcon,
  EditIcon,
  TrashIcon,
  SearchIcon,
  FolderIcon,
  LogoutIcon,
} from "@/components/icons";

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

  const filteredSubjects = useMemo(() => {
    if (!searchQuery.trim()) return subjects;
    const q = searchQuery.toLowerCase().trim();
    return subjects.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.description && s.description.toLowerCase().includes(q))
    );
  }, [subjects, searchQuery]);

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
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-xs font-medium text-slate-400">Đang khởi tạo không gian học tập...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white">
      {/* Header Công Nghệ Cao */}
      <header className="sticky top-0 z-30 border-b border-slate-800/80 bg-slate-950/80 px-6 py-3.5 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-600 text-white shadow-lg shadow-cyan-500/20">
              <LogoIcon size={22} />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tight">
                Study<span className="text-cyan-400">Space.</span>
              </h1>
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Workspace Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <div className="flex items-center gap-2.5 rounded-xl border border-slate-800 bg-slate-900/90 px-3.5 py-1.5 text-xs">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-500/10 font-bold text-cyan-400">
                {userName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden text-left sm:block">
                <p className="font-semibold text-slate-200">{userName}</p>
                <p className="text-[11px] text-slate-400">{userEmail}</p>
              </div>
            </div>

            <button
              onClick={logout}
              className="flex items-center gap-1.5 rounded-xl border border-red-500/30 bg-red-500/10 px-3.5 py-2 text-xs font-semibold text-red-300 transition hover:bg-red-500 hover:text-white"
            >
              <LogoutIcon size={14} />
              <span>Đăng xuất</span>
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 sm:py-10">
        {/* Banner Chào Mừng Công Nghệ */}
        <section className="relative overflow-hidden rounded-3xl border border-slate-800/80 bg-gradient-to-r from-blue-900/40 via-indigo-950/50 to-slate-900/80 p-6 sm:p-8 backdrop-blur-xl">
          <div className="relative z-10 max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3 py-1 text-xs font-bold uppercase tracking-wider text-cyan-300">
              <SparklesIcon size={14} className="text-cyan-400" />
              <span>Không gian học tập thông minh</span>
            </div>

            <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
              Xin chào, {userName}!
            </h2>

            <p className="mt-2 text-xs leading-relaxed text-slate-300 sm:text-sm">
              Quản lý các học phần môn học, lưu trữ tài liệu sinh viên và khai thác sức mạnh AI trích xuất kiến thức trọng tâm cho kỳ thi.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <button
                onClick={() => router.push("/dashboard/documents")}
                className="flex items-center gap-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-5 py-3 text-xs font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-[0.99] sm:text-sm"
              >
                <FolderIcon size={18} />
                <span>Quản lý & Tải tài liệu sinh viên</span>
              </button>
            </div>
          </div>
        </section>

        {/* 3 Thẻ Thống Kê Công Nghệ */}
        <section className="mt-7 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition hover:border-blue-500/40">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Môn học đã tạo</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-400">
                <BookOpenIcon size={18} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-blue-400">{subjects.length}</p>
            <p className="mt-1 text-[11px] text-slate-400">Các môn học trong học kỳ hiện tại</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition hover:border-emerald-500/40">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Tài liệu đã lưu</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400">
                <FileTextIcon size={18} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-emerald-400">{documents.length}</p>
            <p className="mt-1 text-[11px] text-slate-400">PDF, Slide, Word, Excel đã tải lên</p>
          </div>

          <div className="rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition hover:border-purple-500/40">
            <div className="flex items-center justify-between text-slate-400">
              <span className="text-xs font-bold uppercase tracking-wider">Trợ lý AI Ôn Thi</span>
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400">
                <SparklesIcon size={18} />
              </div>
            </div>
            <p className="mt-3 text-3xl font-black text-purple-400">Active</p>
            <p className="mt-1 text-[11px] text-slate-400">Trích xuất ý chính & luận điểm ôn thi</p>
          </div>
        </section>

        {/* Form Thêm / Chỉnh Sửa Môn Học */}
        <section className="mt-8 rounded-2xl border border-slate-800/80 bg-slate-900/90 p-6 backdrop-blur-xl">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10 text-blue-400">
              {editingId ? <EditIcon size={18} /> : <PlusIcon size={18} />}
            </div>
            <h3 className="text-base font-bold text-white sm:text-lg">
              {editingId ? "Cập nhật thông tin môn học" : "Thêm môn học mới"}
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
                placeholder="Ví dụ: Lập trình Web, Cơ sở dữ liệu..."
                className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500"
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
                  Màu đại diện của môn học trên bảng điều khiển
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
                placeholder="Nhập tên giảng viên, phòng học, mã học phần hoặc ghi chú..."
                rows={2}
                className="w-full rounded-xl border border-slate-700 bg-slate-800/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500"
              />
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 md:col-span-2">
                {error}
              </div>
            )}

            <div className="flex flex-wrap gap-3 md:col-span-2">
              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 to-cyan-600 px-6 py-2.5 text-xs font-bold text-white shadow-md shadow-blue-600/30 transition hover:brightness-110 disabled:opacity-50 sm:text-sm"
              >
                {editingId ? <EditIcon size={16} /> : <PlusIcon size={16} />}
                <span>
                  {saving
                    ? "Đang lưu..."
                    : editingId
                      ? "Cập nhật môn học"
                      : "Thêm môn học"}
                </span>
              </button>

              {editingId && (
                <button
                  type="button"
                  onClick={cancelEdit}
                  className="rounded-xl bg-slate-800 px-5 py-2.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                >
                  Hủy bỏ
                </button>
              )}
            </div>
          </form>
        </section>

        {/* Danh Sách Môn Học */}
        <section className="mt-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-xl font-bold text-white sm:text-2xl">
                Môn học của tôi
              </h3>
              <p className="text-xs text-slate-400">
                Tổng cộng {subjects.length} môn học trong danh sách
              </p>
            </div>

            {subjects.length > 0 && (
              <div className="relative w-full sm:w-72">
                <SearchIcon
                  size={16}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm kiếm môn học..."
                  className="w-full rounded-xl border border-slate-800 bg-slate-900/90 py-2.5 pl-10 pr-4 text-xs text-white placeholder-slate-500 outline-none focus:border-cyan-500"
                />
              </div>
            )}
          </div>

          {subjects.length === 0 ? (
            <div className="mt-6 rounded-3xl border border-dashed border-slate-800 bg-slate-900/50 p-12 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/10 text-cyan-400">
                <BookOpenIcon size={32} />
              </div>
              <p className="mt-4 text-base font-bold text-slate-200">
                Bạn chưa thêm môn học nào
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Hãy sử dụng biểu mẫu ở trên để thêm các môn học bạn đang theo học nhé!
              </p>
            </div>
          ) : filteredSubjects.length === 0 ? (
            <div className="mt-6 rounded-2xl border border-slate-800 bg-slate-900 p-8 text-center text-xs text-slate-400 sm:text-sm">
              Không tìm thấy môn học nào khớp với từ khóa &quot;{searchQuery}&quot;.
            </div>
          ) : (
            <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {filteredSubjects.map((subject) => {
                const count = docsCountBySubject[subject.id] || 0;
                return (
                  <article
                    key={subject.id}
                    className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-slate-800 bg-slate-900/80 p-5 transition hover:border-slate-700 hover:shadow-xl"
                  >
                    <div>
                      {/* Vạch màu môn học */}
                      <div
                        className="mb-4 h-1.5 w-14 rounded-full"
                        style={{ backgroundColor: subject.color }}
                      />

                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-base font-bold text-white transition group-hover:text-cyan-400">
                          {subject.name}
                        </h4>
                        <span className="inline-flex items-center gap-1 rounded-md bg-slate-800/90 px-2 py-0.5 text-[11px] font-semibold text-slate-300">
                          <FileTextIcon size={12} className="text-cyan-400" />
                          <span>{count} tài liệu</span>
                        </span>
                      </div>

                      <p className="mt-2 text-xs leading-relaxed text-slate-400 line-clamp-3">
                        {subject.description || "Chưa có ghi chú mô tả cho môn học này."}
                      </p>
                    </div>

                    <div className="mt-6 border-t border-slate-800/80 pt-4">
                      {/* Nút xem tài liệu */}
                      <button
                        onClick={() =>
                          router.push(
                            `/dashboard/documents?subjectId=${subject.id}`
                          )
                        }
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-500/10 py-2.5 text-xs font-bold text-cyan-400 transition hover:bg-cyan-500 hover:text-slate-950"
                      >
                        <FolderIcon size={15} />
                        <span>Xem tài liệu môn này ({count})</span>
                      </button>

                      <div className="mt-2 flex gap-2">
                        <button
                          onClick={() => editSubject(subject)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-slate-800 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700"
                        >
                          <EditIcon size={13} />
                          <span>Sửa</span>
                        </button>
                        <button
                          onClick={() => deleteSubject(subject)}
                          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-red-500/10 py-1.5 text-xs font-semibold text-red-400 hover:bg-red-500 hover:text-white"
                        >
                          <TrashIcon size={13} />
                          <span>Xóa</span>
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
