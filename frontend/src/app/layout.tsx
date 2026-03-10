import type { Metadata } from "next";
import { ClerkProvider } from "@clerk/nextjs";

import { ErrorBoundary } from "@/components/common/ErrorBoundary";
import { APP_NAME, APP_TAGLINE } from "@/constants/config";

import "./globals.css";

export const metadata: Metadata = {
  title: `${APP_NAME} | Clinical Trial Eligibility Simulation`,
  description: APP_TAGLINE,
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
