"use client";

import { Toaster } from "sonner";

export function AppToaster() {
  return (
    <Toaster
      position="bottom-right"
      duration={3000}
      toastOptions={{
        className: "border border-border/70 bg-card text-card-foreground shadow-lg"
      }}
    />
  );
}
