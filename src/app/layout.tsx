import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/sidebar";
import { AutoSync } from "@/components/auto-sync";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "FinAgent - Tu Agente Financiero",
  description: "Gestiona tus finanzas personales con inteligencia",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="es"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <div className="flex h-full">
          <Sidebar />
          <AutoSync />
          <main className="flex-1 overflow-y-auto p-4 pt-16 lg:pt-8 lg:p-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
