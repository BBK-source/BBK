import type { Metadata } from "next";
import "./globals.css";

const basePath = process.env.GITHUB_ACTIONS === "true" ? "/BBK" : "";

export const metadata: Metadata = {
  title: "BBK Bunken",
  description:
    "Paste expert-profile emails, format them automatically, and copy rich text to Gmail.",
  icons: {
    icon: `${basePath}/bbk-work-buddy.png`,
    shortcut: `${basePath}/bbk-work-buddy.png`,
    apple: `${basePath}/bbk-work-buddy.png`,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>{children}</body>
    </html>
  );
}
