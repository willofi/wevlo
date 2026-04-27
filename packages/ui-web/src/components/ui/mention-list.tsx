"use client";

import { forwardRef, useEffect, useImperativeHandle, useState } from "react";
import { cn } from "../../lib/utils";
import type { WorkspaceMemberDto } from "@wevlo/contracts";

export type MentionListProps = {
  items: WorkspaceMemberDto[];
  command: (props: { id: string; label: string; name: string }) => void;
};

export const MentionList = forwardRef(function MentionList(props: MentionListProps, ref) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];

    if (item) {
      props.command({ id: item.userId, label: item.user.handle, name: item.user.name });
    }
  };

  const upHandler = () => {
    if (props.items.length === 0) {
      return;
    }

    setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
  };

  const downHandler = () => {
    if (props.items.length === 0) {
      return;
    }

    setSelectedIndex((selectedIndex + 1) % props.items.length);
  };

  const enterHandler = () => {
    selectItem(selectedIndex);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === "ArrowUp") {
        upHandler();
        return true;
      }

      if (event.key === "ArrowDown") {
        downHandler();
        return true;
      }

      if (event.key === "Enter") {
        enterHandler();
        return true;
      }

      return false;
    }
  }));

  return (
    <div className="z-50 overflow-hidden rounded-lg border border-border/70 bg-popover p-1 shadow-xl shadow-black/10 min-w-48">
      {props.items.length ? (
        props.items.map((item, index) => (
          <button
            className={cn(
              "flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-left text-sm transition-colors",
              index === selectedIndex ? "bg-secondary" : "hover:bg-secondary/70"
            )}
            key={item.userId}
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => selectItem(index)}
          >
            <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-secondary-foreground/10 text-[9px] font-bold">
              {item.user.name.slice(0, 1).toUpperCase()}
            </span>
            <div className="min-w-0">
              <div className="truncate font-medium text-foreground">{item.user.name}</div>
              <div className="truncate text-[11px] text-muted-foreground">@{item.user.handle}</div>
            </div>
          </button>
        ))
      ) : (
        <div className="px-3 py-2 text-sm text-muted-foreground">No users found</div>
      )}
    </div>
  );
});
