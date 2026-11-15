import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import "./globals.css";

// Fonts ship inside the app (open-source, OFL) so builds never depend on
// reaching Google Fonts; a fresh Vercel build failed fetching them.
const inter = localFont({ src: "./fonts/inter-latin-wght-normal.woff2", weight: "100 900", variable: "--font-inter", display: "swap" });
// Heavy display face for the wordmark and big headline; Archivo 800 for form titles.
const archivoBlack = localFont({ src: "./fonts/archivo-black-latin-400-normal.woff2", weight: "400", variable: "--font-display", display: "swap" });
const archivo = localFont({
  src: [
    { path: "./fonts/archivo-latin-700-normal.woff2", weight: "700" },
    { path: "./fonts/archivo-latin-800-normal.woff2", weight: "800" },
  ],
  variable: "--font-heading",
  display: "swap",
});

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
