import type { Metadata } from "next";
import { Source_Sans_3, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const sourceSans = Source_Sans_3({
  variable: "--font-source-sans",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const sourceSerif = Source_Serif_4({
  variable: "--font-source-serif",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Kars Belediyesi — Saha Operasyon Yönetim Sistemi",
  description:
    "Şikayet, araç, bakım, görevlendirme ve günlük çalışma takip sistemi",
  // ?v= ile tarayıcı favicon cache'i kırılır (eski Next ikonu takılı kalmasın)
  icons: {
    icon: [
      { url: "/favicon.png?v=3", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png?v=3", type: "image/png", sizes: "192x192" },
      { url: "/favicon.ico?v=3", sizes: "any" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180" }],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="tr">
      <body
        className={`${sourceSans.variable} ${sourceSerif.variable} font-sans antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
