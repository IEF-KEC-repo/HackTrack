import type { Metadata } from "next";
import "./globals.css";
import { AppChrome } from "@/components/AppChrome";

export const metadata: Metadata = {
  title: "HackTrack | Collegiate Innovation & Hackathon Management",
  description:
    "Enterprise hackathon platform supporting multi-edition lifecycle, rubrics, and normalization.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full bg-slate-50 text-slate-900 antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <AppChrome>{children}</AppChrome>
      </body>
    </html>
  );
}