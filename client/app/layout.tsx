import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/components/auth-provider";
import { PwaProvider } from "@/components/pwa/pwa-provider";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "Pocksyra",
  description: "Split expenses with friends, beautifully.",
  applicationName: "Pocksyra",
  // iOS "Add to Home Screen" behaviour
  appleWebApp: { capable: true, title: "Pocksyra", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#06100d",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable}`}>
      <body className="font-sans text-ivory-100 antialiased">
        <PwaProvider>
          <AuthProvider>{children}</AuthProvider>
        </PwaProvider>
      </body>
    </html>
  );
}
