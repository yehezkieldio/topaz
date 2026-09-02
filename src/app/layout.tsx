import "./globals.css";

import { Analytics } from "@vercel/analytics/next";
import { SpeedInsights } from "@vercel/speed-insights/next";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Playfair_Display } from "next/font/google";
import { NuqsAdapter } from "nuqs/adapters/next";
import { ThemeProvider } from "#/app/theme-provider";
import { Toaster } from "#/app/toaster";
import { cn } from "#/lib/utils";
import { TRPCReactProvider } from "#/trpc/react";

const geistSans = Geist({
    subsets: ["latin"],
    variable: "--font-geist-sans",
});

const geistMono = Geist_Mono({
    subsets: ["latin"],
    variable: "--font-geist-mono",
});

const playfairDisplay = Playfair_Display({
    subsets: ["latin"],
    variable: "--font-playfair-display",
});

export const metadata: Metadata = {
    description: "A personal tool for tracking fanfiction, webnovels, and online fiction.",
    icons: {
        apple: "/apple-touch-icon.png",
        icon: [
            { sizes: "16x16", type: "image/png", url: "/favicon-16x16.png" },
            { sizes: "32x32", type: "image/png", url: "/favicon-32x32.png" },
            { url: "/favicon.ico" },
        ],
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
    keywords: ["digital library", "fanfiction", "personal tool", "reading tracker", "webnovels"],
    manifest: "/site.webmanifest",
    openGraph: {
        description: "A personal tool for tracking fanfiction, webnovels, and online fiction.",
        locale: "en_US",
        siteName: "Topaz",
        title: "Topaz",
        type: "website",
        url: process.env.NEXT_PUBLIC_SITE_URL,
    },
    robots: {
        follow: true,
        googleBot: {
            follow: true,
            index: true,
            "max-image-preview": "large",
            "max-snippet": -1,
            "max-video-preview": -1,
        },
        index: true,
    },
    title: {
        default: "Topaz",
        template: "%s",
    },
    twitter: {
        card: "summary_large_image",
        description: "A personal tool for tracking fanfiction, webnovels, and online fiction.",
        title: "Topaz",
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en" suppressHydrationWarning>
            <body className={cn(geistSans.variable, geistMono.variable, playfairDisplay.variable, "antialiased")}>
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
