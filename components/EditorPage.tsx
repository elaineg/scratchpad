"use client";

import dynamic from "next/dynamic";

// Load Editor client-side only (TipTap is not SSR-safe)
const Editor = dynamic(() => import("./Editor"), { ssr: false });

export default function EditorPage() {
  return (
    <main
      style={{
        background: "#FBFAF8",
        minHeight: "100vh",
        padding: "12vh 1.5rem 6rem",
      }}
    >
      <div
        style={{
          maxWidth: "68ch",
          margin: "0 auto",
          position: "relative",
        }}
      >
        <Editor />
      </div>
    </main>
  );
}
