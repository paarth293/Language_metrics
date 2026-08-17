import type { Metadata } from "next";
import { Fraunces, Manrope, Caveat } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/lib/auth-client";
import { ThemeProvider } from "@/components/ThemeProvider";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  weight: ["300", "400", "500", "600", "700", "800", "900"],
  display: "swap",
});

const manrope = Manrope({
  subsets: ["latin"],
  variable: "--font-manrope",
  weight: ["300", "400", "500", "600", "700", "800"],
  display: "swap",
});

const caveat = Caveat({
  subsets: ["latin"],
  variable: "--font-script",
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Language Metrics — Find Your Perfect Language Teacher",
  description:
    "Connect with verified language professionals for 1-on-1 live classes. Learn any language with expert teachers via our custom video platform.",
  keywords:
    "language learning, online language classes, language teacher, 1-on-1 tutoring, live language lessons",
  openGraph: {
    title: "Language Metrics — Find Your Perfect Language Teacher",
    description:
      "Connect with verified language professionals for 1-on-1 live classes.",
    type: "website",
  },
};

const themeScript = `
  (function() {
    try {
      var stored = localStorage.getItem('lm-theme');
      var theme = stored || 'auto';
      if (theme === 'auto') {
        var systemDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        document.documentElement.setAttribute('data-theme', systemDark ? 'dark' : 'light');
      } else {
        document.documentElement.setAttribute('data-theme', theme);
      }
    } catch (e) {}
  })();
`;

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      data-scroll-behavior="smooth"
      suppressHydrationWarning
      className={`${fraunces.variable} ${manrope.variable} ${caveat.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="font-body antialiased">
        <ThemeProvider>
          <AuthProvider>{children}</AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
