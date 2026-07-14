import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import "./globals.css";

export const metadata: Metadata = {
  title: "Con-Share",
  description: "Share photos from your conventions.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-dvh bg-white text-gray-900 antialiased">
        <Header />
        <main className="mx-auto w-full max-w-screen-lg px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
