import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "MeetLive - Crystal Clear Online Meetings",
  description: "Production-ready online meeting platform with crystal clear audio, low-latency communication, and seamless scheduling. Built with React, Node.js, and mediasoup.",
  keywords: ["MeetLive", "online meetings", "video conferencing", "audio calls", "real-time communication", "React", "mediasoup"],
  authors: [{ name: "MeetLive Team" }],
  icons: {
    icon: "https://z-cdn.chatglm.cn/z-ai/static/logo.svg",
  },
  openGraph: {
    title: "MeetLive - Crystal Clear Online Meetings",
    description: "Low-latency audio meetings that work even on slow internet.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
        suppressHydrationWarning
      >
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  );
}
