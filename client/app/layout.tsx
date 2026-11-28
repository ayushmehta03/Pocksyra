import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { MotionProvider } from "@/components/motion";
import { PwaProvider } from "@/components/pwa/pwa-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { NO_FLASH_SCRIPT, THEME_COLORS } from "@/lib/theme";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono" });

export const metadata: Metadata = {
  title: "Pocksyra",
  description: "Split expenses with friends, beautifully.",
  applicationName: "Pocksyra",
  // iOS "Add to Home Screen" behaviour
  appleWebApp: { capable: true, title: "Pocksyra", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  // The inline script below corrects this to day or night before the first paint.
  themeColor: THEME_COLORS.dark,
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: the script below sets the day/night class before React loads.
    <html lang="en" className={`${geist.variable} ${geistMono.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: NO_FLASH_SCRIPT }} />
      </head>
      <body className="font-sans text-fg antialiased">
        <ThemeProvider>
          <MotionProvider>
            <PwaProvider>
              <AuthProvider>{children}</AuthProvider>
            </PwaProvider>
          </MotionProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
