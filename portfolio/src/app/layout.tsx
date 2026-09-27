import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { Background } from "@/components/layout/Background";
import { OverlayHost } from "@/components/terminal/OverlayHost";
import { SITE_URL } from "@/lib/site";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  // Only when NEXT_PUBLIC_SITE_URL is set (see lib/site.ts): social-image and canonical URLs need an absolute origin.
  ...(SITE_URL ? { metadataBase: new URL(SITE_URL) } : {}),
  title: "Rahul | Full-Stack Developer",
  description: "Full-stack developer (Flask, React) building and operating production systems, moving into DevOps.",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8f4" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0b10" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <noscript>
          <style>{".reveal{opacity:1!important;transform:none!important}.mask-in,.chapter-rule{transform:none!important}"}</style>
        </noscript>
        <Background />
        <ThemeProvider>
          {children}
          <OverlayHost />
        </ThemeProvider>
      </body>
    </html>
  );
}
