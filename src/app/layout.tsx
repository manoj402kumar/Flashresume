import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Flashresume",
  description: "Your resume, rebuilt in 60 seconds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
