import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Meal Builder",
  description: "Drag & drop meal planner with KBJU tracking",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body>{children}</body>
    </html>
  );
}
