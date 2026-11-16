"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

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
    return "Tài khoản chưa được kích hoạt qua email. Vui lòng kiểm tra hộp thư (cả mục Spam) để xác thực.";
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

  // Kiểm tra phiên đăng nhập đã có và tải email đã ghi nhớ
  useEffect(() => {
    async function checkExistingSession() {
      try {
        const { data } = await supabase.auth.getSession();
        if (data?.session?.user) {
          router.replace("/dashboard");
          return;
        }

        // Tải email đã lưu trong localStorage nếu có
        const savedEmail = localStorage.getItem(REMEMBER_EMAIL_KEY);
        if (savedEmail) {
          setEmail(savedEmail);
          setRememberMe(true);
        }
      } catch {
        // bỏ qua lỗi kiểm tra phiên
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
            data: {
              full_name: fullName.trim(),
            },
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
          <div className="h-9 w-9 animate-spin rounded-full border-4 border-blue-500 border-t-transparent" />
          <p className="text-sm text-slate-400">Đang khởi tạo StudySpace...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-950 px-4 py-8 text-white sm:px-6 sm:py-12">
      <div className="grid w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-800 bg-slate-900 shadow-2xl md:grid-cols-2">
        {/* Banner Giới Thiệu */}
        <section className="relative hidden flex-col justify-between overflow-hidden bg-gradient-to-br from-blue-700 via-blue-800 to-indigo-950 p-12 md:flex">
          <div className="relative z-10">
            <div className="flex items-center gap-2 text-3xl font-black tracking-tight">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 text-xl backdrop-blur-sm">
                🎓
              </span>
              <span>
                Study<span className="text-cyan-300">Space.</span>
              </span>
            </div>
            <p className="mt-3 text-xs font-semibold tracking-wider text-blue-200 uppercase">
              NỀN TẢNG HỌC TẬP THÔNG MINH CHO SINH VIÊN
            </p>
          </div>

          <div className="relative z-10 my-10">
            <div className="mb-4 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold text-cyan-200 backdrop-blur-md">
              <span>✦</span> Không gian lưu trữ & AI hỗ trợ học tập
            </div>
            <h1 className="text-3xl font-bold leading-snug lg:text-4xl">
              Tổ chức môn học.
              <br />
              Lưu trữ tài liệu tức thì.
              <br />
              Tóm tắt bài học cùng AI.
            </h1>
            <p className="mt-5 text-sm leading-relaxed text-blue-100">
              Giúp sinh viên lưu trữ giáo trình, slide bài giảng, phân loại theo môn học và ứng dụng AI tự động đọc và tóm tắt kiến thức ôn thi.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 text-xs">
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                <p className="font-bold text-white">📁 Quản lý tập trung</p>
                <p className="mt-1 text-blue-200">Phân loại tài liệu theo từng môn học rõ ràng</p>
              </div>
              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm">
                <p className="font-bold text-white">✨ Trợ lý AI</p>
                <p className="mt-1 text-blue-200">Đọc PDF & trích xuất ý chính trọng tâm</p>
              </div>
            </div>
          </div>

          <div className="relative z-10 flex items-center justify-between text-xs text-blue-200/80">
            <span>© 2026 StudySpace Cloud</span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              Hệ thống trực tuyến
            </span>
          </div>
        </section>

        {/* Khung Đăng Nhập / Đăng Ký */}
        <section className="flex flex-col justify-center p-6 sm:p-10 lg:p-12">
          <div className="mb-8 md:hidden">
            <div className="flex items-center gap-2 text-2xl font-black">
              <span>🎓</span>
              <span>
                Study<span className="text-blue-400">Space.</span>
              </span>
            </div>
          </div>

          <div className="mb-7">
            <p className="text-xs font-bold uppercase tracking-widest text-blue-400">
              {mode === "login" ? "Chào mừng trở lại" : "Tạo tài khoản mới"}
            </p>
            <h2 className="mt-2 text-2xl font-bold sm:text-3xl">
              {mode === "login" ? "Đăng nhập tài khoản" : "Bắt đầu cùng StudySpace"}
            </h2>
            <p className="mt-1.5 text-xs text-slate-400 sm:text-sm">
              {mode === "login"
                ? "Đăng nhập để truy cập tài liệu và không gian môn học của bạn."
                : "Tạo tài khoản miễn phí để lưu trữ và quản lý học tập cá nhân."}
            </p>
          </div>

          {/* Toggle Chuyển Mode */}
          <div className="mb-6 grid grid-cols-2 rounded-xl bg-slate-800 p-1">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setMessage("");
                setError("");
              }}
              className={`rounded-lg py-2.5 text-xs font-semibold transition sm:text-sm ${
                mode === "login"
                  ? "bg-blue-600 text-white shadow-md"
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
              className={`rounded-lg py-2.5 text-xs font-semibold transition sm:text-sm ${
                mode === "register"
                  ? "bg-blue-600 text-white shadow-md"
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
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
              </div>
            )}

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Email *
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="sinhvien@example.com"
                className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
              />
            </div>

            <div>
              <label className="mb-1.5 block text-xs font-semibold text-slate-300">
                Mật khẩu *
              </label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Tối thiểu 6 ký tự"
                  className="w-full rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 pr-11 text-sm text-white placeholder-slate-500 outline-none transition focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  {showPassword ? "🙈" : "👁️"}
                </button>
              </div>
            </div>

            {/* Ghi nhớ thông tin đăng nhập */}
            <div className="flex items-center justify-between pt-1">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-700 bg-slate-800 text-blue-600 focus:ring-0 focus:ring-offset-0"
                />
                <span>Ghi nhớ thông tin đăng nhập</span>
              </label>
            </div>

            {error && (
              <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs leading-5 text-red-300 sm:text-sm">
                ⚠️ {error}
              </div>
            )}

            {message && (
              <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-3 text-xs leading-5 text-green-300 sm:text-sm">
                ✅ {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-500 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && (
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {loading
                ? "Đang xử lý..."
                : mode === "login"
                  ? "Đăng nhập vào StudySpace"
                  : "Tạo tài khoản mới"}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-slate-500">
            Bằng việc sử dụng StudySpace, bạn đồng ý với tiêu chuẩn bảo mật dữ liệu học tập cá nhân.
          </p>
        </section>
      </div>
    </main>
  );
}
