"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  LogoIcon,
  SparklesIcon,
  FolderIcon,
  CpuIcon,
  EyeIcon,
  ShieldCheckIcon,
  CheckIcon,
} from "@/components/icons";

const REMEMBER_EMAIL_KEY = "studyspace_remembered_email";

function mapAuthError(message: string): string {
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) {
    return "Email hoặc mật khẩu không chính xác. Vui lòng kiểm tra lại.";
  }
  if (lower.includes("user already registered")) {
    return "Email này đã được đăng ký tài khoản. Bạn vui lòng chuyển sang Đăng nhập.";
  }
  if (lower.includes("email not confirmed")) {
    return "Tài khoản chưa được kích hoạt qua email. Vui lòng kiểm tra hộp thư để xác thực.";
  }
  if (lower.includes("password should be at least")) {
    return "Mật khẩu cần có ít nhất 6 ký tự để đảm bảo an toàn.";
  }
  if (lower.includes("rate limit") || lower.includes("too many requests")) {
    return "Bạn đã thao tác quá nhiều lần. Vui lòng đợi vài phút rồi thử lại.";
  }
  return message;
}

export default function Home() {
  const router = useRouter();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

  const [checkingSession, setCheckingSession] = useState(true);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const supabase = createClient();

  useEffect(() => {
    async function checkExistingSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          router.replace("/dashboard");
          return;
        }

        const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch {
        // ignore
      } finally {
        setCheckingSession(false);
      }
    }

    checkExistingSession();
  }, [router, supabase]);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setError("");

    try {
      if (mode === "register") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: { full_name: fullName.trim() },
            emailRedirectTo: `${window.location.origin}/dashboard`,
          },
        });

        if (signUpError) throw signUpError;

        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }

        if (data.session) {
          router.push("/dashboard");
        } else {
          setMessage(
            "Đăng ký tài khoản thành công! Vui lòng kiểm tra hộp thư email để kích hoạt tài khoản."
          );
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });

        if (signInError) throw signInError;

        if (rememberMe) {
          localStorage.setItem(REMEMBER_EMAIL_KEY, email.trim());
        } else {
          localStorage.removeItem(REMEMBER_EMAIL_KEY);
        }

        router.push("/dashboard");
      }
    } catch (err) {
      const rawMsg = err instanceof Error ? err.message : "Đã xảy ra lỗi. Vui lòng thử lại.";
      setError(mapAuthError(rawMsg));
    } finally {
      setLoading(false);
    }
  }

  if (checkingSession) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center gap-3">
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-cyan-500 border-t-transparent" />
          <p className="text-xs font-medium text-slate-400">Đang đồng bộ StudySpace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-12">
      {/* Background Tech Glow */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-96 w-96 rounded-full bg-blue-600/20 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-cyan-600/15 blur-[120px]" />

      <div className="relative z-10 grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800/80 bg-slate-900/90 shadow-2xl backdrop-blur-xl md:grid-cols-2">
        {/* Banner Giới Thiệu Công Nghệ */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-indigo-900 to-slate-950 p-12 md:flex">
          <div className="relative z-10">
            <div className="flex items-center gap-3 text-3xl font-black tracking-tight">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-400 to-blue-500 text-white shadow-lg shadow-cyan-500/30">
                <LogoIcon size={24} />
              </div>
              <span>
                Study<span className="text-cyan-400">Space.</span>
              </span>
            </div>
            <p className="mt-3 text-[11px] font-bold tracking-widest text-cyan-200/90 uppercase">
              NEXT-GEN SMART LEARNING CLOUD
            </p>
          </div>

          <div className="relative z-10 my-8">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-cyan-400/30 bg-cyan-500/10 px-3.5 py-1 text-xs font-semibold text-cyan-300 backdrop-blur-md">
              <SparklesIcon size={14} className="text-cyan-400" />
              <span>Nền Tảng Đám Mây Tích Hợp AI 2026</span>
            </div>

            <h1 className="text-3xl font-extrabold leading-tight text-white lg:text-4xl">
              Tổ chức môn học.
              <br />
              Lưu trữ tài liệu tức thì.
              <br />
              Tóm tắt đề thi cùng AI.
            </h1>

            <p className="mt-4 text-xs leading-relaxed text-blue-100/90 sm:text-sm">
              Hệ thống lưu trữ đám mây tốc độ cao dành cho sinh viên. Quản lý giáo trình, bài giảng và ứng dụng mô hình trí tuệ nhân tạo để trích xuất kiến thức trọng tâm.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition hover:border-cyan-400/40">
                <div className="flex items-center gap-2 font-bold text-white">
                  <FolderIcon size={16} className="text-cyan-400" />
                  <span>Quản lý tập trung</span>
                </div>
                <p className="mt-1 text-[11px] text-blue-200/80">
                  Phân loại slide, giáo trình theo môn học
                </p>
              </div>

              <div className="rounded-2xl border border-white/10 bg-white/5 p-3.5 backdrop-blur-md transition hover:border-cyan-400/40">
                <div className="flex items-center gap-2 font-bold text-white">
                  <CpuIcon size={16} className="text-cyan-400" />
                  <span>Trợ lý AI Đọc PDF</span>
                </div>
                <p className="mt-1 text-[11px] text-blue-200/80">
                  Tổng hợp công thức & luận điểm ôn tập
                </p>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-[11px] text-blue-200/80 border-t border-white/10 pt-4">
            <span>© 2026 StudySpace Cloud</span>
            <span className="flex items-center gap-1.5 font-medium text-emerald-300">
              <span className="h-2 w-2 animate-pulse rounded-full bg-emerald-400" />
              Cloud Engine Trực Tuyến
            </span>
          </div>
        </section>

        {/* Khung Đăng Nhập / Đăng Ký */}
        <section className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
          <div className="mb-7 md:hidden">
            <div className="flex items-center gap-2.5 text-2xl font-black">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-cyan-400 to-blue-500 text-white">
                <LogoIcon size={20} />
              </div>
              <span>
                Study<span className="text-cyan-400">Space.</span>
              </span>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-[11px] font-bold uppercase tracking-widest text-cyan-400">
              {mode === "login" ? "Xác thực bảo mật" : "Tài khoản học tập mới"}
            </p>
            <h2 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
              {mode === "login" ? "Đăng nhập tài khoản" : "Tạo tài khoản StudySpace"}
            </h2>
            <p className="mt-1 text-xs text-slate-400">
              {mode === "login"
                ? "Truy cập không gian môn học và kho tài liệu cá nhân của bạn."
                : "Tham gia nền tảng để lưu trữ và ứng dụng AI vào việc học."}
            </p>
          </div>

          {/* Toggle Chuyển Mode Hiện Đại */}
          <div className="mb-5 grid grid-cols-2 rounded-2xl border border-slate-800 bg-slate-950/60 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
                setError("");
              }}
              className={`rounded-xl py-2.5 text-xs font-bold transition sm:text-sm ${
                mode === "login"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("register");
                setMessage("");
                setError("");
              }}
              className={`rounded-xl py-2.5 text-xs font-bold transition sm:text-sm ${
                mode === "register"
                  ? "bg-gradient-to-r from-blue-600 to-cyan-600 text-white shadow-md shadow-blue-600/30"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              Đăng ký
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === "register" && (
              <div>
                <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                  Họ và tên sinh viên *
                </label>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Ví dụ: Nguyễn Văn An"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-800/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Địa chỉ Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sinhvien@example.com"
                className="w-full rounded-xl border border-slate-700/80 bg-slate-800/70 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Mật khẩu truy cập *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full rounded-xl border border-slate-700/80 bg-slate-800/70 px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 outline-none transition focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password"
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-cyan-400 transition"
                >
                  <EyeIcon size={18} className={showPassword ? "text-cyan-400" : ""} />
                </button>
              </div>
            </div>

            {/* Checkbox Ghi nhớ thông tin đăng nhập */}
            <div className="flex items-center justify-between pt-0.5">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300 hover:text-white transition">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0"
                />
                <span>Ghi nhớ thông tin tài khoản</span>
              </label>
            </div>

            {error && (
              <div className="flex items-start gap-2.5 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300 sm:text-sm">
                <ShieldCheckIcon size={16} className="mt-0.5 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {message && (
              <div className="flex items-start gap-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-300 sm:text-sm">
                <CheckIcon size={16} className="mt-0.5 shrink-0 text-emerald-400" />
                <span>{message}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-blue-600 via-blue-500 to-cyan-500 py-3.5 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              <span>
                {loading
                  ? "Đang xác thực bảo mật..."
                  : mode === "login"
                    ? "Đăng nhập vào StudySpace"
                    : "Khởi tạo tài khoản"}
              </span>
            </button>
          </form>

          <p className="mt-6 text-center text-[11px] text-slate-500">
            Bảo mật 256-bit mã hóa đầu cuối cho tài liệu và dữ liệu sinh viên.
          </p>
        </section>
      </div>
    </main>
  );
}
