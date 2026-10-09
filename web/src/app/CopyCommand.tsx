"use client";

import { useState } from "react";

type CopyCommandProps = {
  command: string;
};

export default function CopyCommand({ command }: CopyCommandProps) {
  const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

  async function copyCommand() {
    try {
      await navigator.clipboard.writeText(command);
      setState("copied");
    } catch {
      setState("failed");
    }

    window.setTimeout(() => setState("idle"), 1800);
  }

  const label = state === "copied" ? "Command copied" : state === "failed" ? "Copy failed" : "Copy command";

  return (
    <button
      className="copy-command"
      type="button"
      onClick={copyCommand}
      data-state={state}
      aria-label={label}
      title={label}
    >
      <span className="copy-icon" aria-hidden="true" />
      <span className="visually-hidden" aria-live="polite" aria-atomic="true">{label}</span>
    </button>
  );
}