"use client";
import { useState } from "react";
import { Button } from "./ui";

export function CopyButton({ text, label = "Copy link" }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);
  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(text);
          setDone(true);
          setTimeout(() => setDone(false), 1500);
        } catch {
          prompt("Copy this link:", text);
        }
      }}
    >
      {done ? "Copied ✓" : label}
    </Button>
  );
}
