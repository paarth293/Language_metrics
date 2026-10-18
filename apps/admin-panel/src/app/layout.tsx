import type { Metadata } from "next";
import { Manrope, JetBrains_Mono } from "next/font/google";
import localFont from "next/font/local";
import { ThemeProvider } from "@/components/layout/theme-provider";
import "./globals.css";

// Self-hosted: Google serves Fraunces to next/font as extensionless
// /l/font?kit= URLs, which Turbopack rejects (vercel/next.js#99114). These
// are the same variable files Google serves modern browsers (v38, latin).
const fraunces = localFont({
  src: [
    { path: "./fonts/fraunces-latin.woff2", weight: "300 900", style: "normal" },
    { path: "./fonts/fraunces-latin-italic.woff2", weight: "300 900", style: "italic" },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Admin | Language Metrics",
  description: "Administrative dashboard for the Language Metrics platform",
};

const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('lm-theme');
      var theme = stored || 'light';
      document.documentElement.setAttribute('data-theme', theme === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : theme);
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={`${fraunces.variable} ${manrope.variable} ${jetBrainsMono.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body suppressHydrationWarning>
        <ThemeProvider attribute="data-theme" defaultTheme="light" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
