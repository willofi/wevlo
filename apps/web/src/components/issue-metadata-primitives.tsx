"use client";

import type { ReactNode } from "react";
import { Search } from "lucide-react";

import { cn } from "@wevlo/ui-web";

export function MetadataPill({
  children,
  icon,
  muted = false
}: {
  children: string;
  icon: ReactNode;
  muted?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-border/80 bg-background px-2.5 text-[13px] shadow-sm transition-colors hover:bg-secondary/70",
        muted ? "text-muted-foreground" : "text-foreground"
      )}
    >
      {icon}
      <span className="max-w-[9rem] truncate">{children}</span>
    </span>
  );
}

export function DropdownSearchInput({
  placeholder,
  value,
  onChange
}: {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="px-2 pb-2 pt-1">
      <div className="flex h-8 items-center gap-2 rounded-md border border-border/80 bg-background px-2">
        <Search className="size-3.5 text-muted-foreground" />
        <input
          value={value}
          placeholder={placeholder}
          onChange={(event) => onChange(event.target.value)}
          onKeyDown={(event) => event.stopPropagation()}
          className="w-full bg-transparent text-xs outline-none placeholder:text-muted-foreground"
        />
      </div>
    </div>
  );
}
