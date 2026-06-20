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
      <head>
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Archivo:wght@400;500;600&display=swap"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
