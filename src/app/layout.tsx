
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "StudySpace - Nền tảng học tập thông minh",
  description:
    "Nền tảng quản lý học tập, tài liệu và luyện thi bằng trí tuệ nhân tạo.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
