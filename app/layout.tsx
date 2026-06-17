import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Scratchpad",
  description: "A blank page that's already waiting for you. Open it and just start typing.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
