import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { APP_NAME, APP_TAGLINE } from "@/constants/config";

import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} | Clinical Trial Eligibility Simulation`,
  description: APP_TAGLINE,
  manifest: "/favicon/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [{ url: "/favicon/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    shortcut: ["/favicon/favicon.ico"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider>
      <html lang="en" className="dark" suppressHydrationWarning>
        <body>
          <ErrorBoundary>{children}</ErrorBoundary>
        </body>
      </html>
    </ClerkProvider>
  );
}
