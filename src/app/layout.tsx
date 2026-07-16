import type { Metadata, Viewport } from "next";
import Header from "@/components/Header";
import ThemeProvider from "@/components/ThemeProvider";
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
    <html lang="en" suppressHydrationWarning>
      <body className="min-h-dvh bg-background text-foreground antialiased">
        <ThemeProvider>
          <Header />
          <main className="mx-auto w-full max-w-screen-lg px-4 py-6">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  );
}
