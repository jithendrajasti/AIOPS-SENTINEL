import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import { SessionProvider } from "next-auth/react";
import { auth } from "@/auth";
import { AuthProvider } from "@/context/auth-context";
import { SettingsProvider } from "@/context/settings-context";
import { SocketProvider } from "@/context/socket-context";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const mono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "AI-Ops Sentinel — AI Incident Management",
    template: "%s · AI-Ops Sentinel",
  },
  description:
    "AI-powered incident management & observability platform. Real-time monitoring, AI root cause analysis, and a golden-records knowledge base.",
  icons: {
    icon: [
      { url: "/favicon.png", type: "image/png" },
      { url: "/logo-mark.png", type: "image/png" },
    ],
    apple: "/logo-mark.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#070b14",
  width: "device-width",
  initialScale: 1,
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} font-sans`}>
        <SessionProvider session={session}>
          <AuthProvider>
            <SettingsProvider>
              <SocketProvider>{children}</SocketProvider>
            </SettingsProvider>
          </AuthProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
