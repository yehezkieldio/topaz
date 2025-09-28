import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Space_Grotesk } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next";
import { ThemeProvider } from "#/app/theme-provider";
import { Toaster } from "#/app/toaster";
import { cn } from "#/lib/utils";
import { TRPCReactProvider } from "#/trpc/react";

import "./globals.css";

const geistSans = Geist({
    variable: "--font-geist-sans",
    subsets: ["latin"],
});

const geistMono = Geist_Mono({
    variable: "--font-geist-mono",
    subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
    variable: "--font-space-grotesk",
    subsets: ["latin"],
});

export const metadata: Metadata = {
    title: {
        default: "Topaz",
        template: "%s",
    },
    description: "A personal tool for tracking fanfiction, webnovels, and online fiction.",
    keywords: ["digital library", "fanfiction", "personal tool", "reading tracker", "webnovels"],
    icons: {
        icon: [
            { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
            { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
            { url: "/favicon.ico" },
        ],
        apple: "/apple-touch-icon.png",
        other: [
            {
                rel: "android-chrome-192x192",
                url: "/android-chrome-192x192.png",
            },
            {
                rel: "android-chrome-512x512",
                url: "/android-chrome-512x512.png",
            },
        ],
    },
    manifest: "/site.webmanifest",
    openGraph: {
        type: "website",
        locale: "en_US",
        url: process.env.NEXT_PUBLIC_SITE_URL,
        title: "Topaz",
        description: "A personal tool for tracking fanfiction, webnovels, and online fiction.",
        siteName: "Topaz",
    },
    twitter: {
        card: "summary_large_image",
        title: "Topaz",
        description: "A personal tool for tracking fanfiction, webnovels, and online fiction.",
    },
    robots: {
        index: true,
        follow: true,
        googleBot: {
            index: true,
            follow: true,
            "max-video-preview": -1,
            "max-image-preview": "large",
            "max-snippet": -1,
        },
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={cn(geistSans.variable, geistMono.variable, spaceGrotesk.variable, "antialiased")}>
                <TRPCReactProvider>
                    <NuqsAdapter>
                        <ThemeProvider attribute="class" defaultTheme="dark" disableTransitionOnChange enableSystem>
                            {children}
                            <SpeedInsights />
                            <Analytics />
                            <Toaster />
                        </ThemeProvider>
                    </NuqsAdapter>
                </TRPCReactProvider>
            </body>
        </html>
    );
}
