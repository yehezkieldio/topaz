import type { Metadata } from "next";
import { Archivo, Geist_Mono, Public_Sans } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next/app";

import { ThemeProvider } from "./theme-provider";

import "./globals.css";

const sans = Public_Sans({
  subsets: ["latin"],
  variable: "--font-public-sans",
});

const display = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  variable: "--font-geist-mono",
});

export const metadata: Metadata = {
  description:
    "Yehezkiel Dio Sinolungan -- software engineer, and a self-hosted reading tracker.",
  title: "Yehezkiel Dio Sinolungan",
};

const RootLayout = ({ children }: LayoutProps<"/">) => (
  <html
    className={`${sans.variable} ${display.variable} ${mono.variable} h-full antialiased`}
    lang="en"
    suppressHydrationWarning
  >
    <body className="flex min-h-full flex-col">
      <NuqsAdapter>
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          disableTransitionOnChange
          enableSystem
        >
          {children}
        </ThemeProvider>
      </NuqsAdapter>
    </body>
  </html>
);

export default RootLayout;
