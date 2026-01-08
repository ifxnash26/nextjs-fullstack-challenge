import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/providers";
import { cn } from "@/lib/utils";

const font = Space_Grotesk({ subsets: ["latin"], display: "swap" });
const themeInitScript = `
(() => {
  try {
    const stored = window.localStorage.getItem("assetspace-theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const theme = stored === "light" || stored === "dark" ? stored : prefersDark ? "dark" : "light";
    const root = document.documentElement;
    if (theme === "dark") {
      root.classList.add("dark");
    } else {
      root.classList.remove("dark");
    }
  } catch (error) {
    // Ignore errors (e.g. storage unavailable).
  }
})();
`;

export const metadata: Metadata = {
  title: "AssetSpace AI",
  description: "A focused workspace for IT asset inventory and operations.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={cn("min-h-screen bg-background text-foreground antialiased", font.className)}>
        <Providers>
          <div className="min-h-screen">{children}</div>
        </Providers>
      </body>
    </html>
  );
}
