import type { Metadata, Viewport } from "next";
import { Archivo, Archivo_Black, Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter", display: "swap" });
// Heavy display face for the wordmark and big headline; Archivo 800 for form titles.
const archivoBlack = Archivo_Black({ subsets: ["latin"], weight: "400", variable: "--font-display", display: "swap" });
const archivo = Archivo({ subsets: ["latin"], weight: ["700", "800"], variable: "--font-heading", display: "swap" });

export const metadata: Metadata = {
  title: "Trojan JobMatch",
  description: "Every Trojan deserves the right match.",
};

export const viewport: Viewport = {
  themeColor: "#990000",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning: browser extensions add attributes to <html>
    // before React loads; this ignores only those, on this one tag.
    <html lang="en" suppressHydrationWarning className={`${inter.variable} ${archivoBlack.variable} ${archivo.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
