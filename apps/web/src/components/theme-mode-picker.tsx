"use client";

import { LaptopMinimal, MoonStar, SunMedium } from "lucide-react";

import { Button, cn } from "@wevlo/ui-web";

import { useAppPreferences } from "@/components/app-preferences-provider";

const themeOptions = [
  {
    description: "Follow the device preference automatically.",
    icon: LaptopMinimal,
    label: "System",
    value: "system"
  },
  {
    description: "Keep the interface bright and neutral.",
    icon: SunMedium,
    label: "Light",
    value: "light"
  },
  {
    description: "Use the darker workspace shell everywhere.",
    icon: MoonStar,
    label: "Dark",
    value: "dark"
  }
] as const;

type ThemeModePickerProps = {
  className?: string | undefined;
};

export function ThemeModePicker({ className }: ThemeModePickerProps) {
  const { preferences, setPreference } = useAppPreferences();

  return (
    <div className={cn("grid gap-2 sm:grid-cols-3", className)}>
      {themeOptions.map((option) => {
        const Icon = option.icon;
        const isActive = preferences.theme === option.value;

        return (
          <Button
            key={option.value}
            type="button"
            variant={isActive ? "default" : "subtle"}
            onClick={() => setPreference("theme", option.value)}
            className="h-auto min-h-28 flex-col items-start rounded-2xl px-4 py-3 text-left"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-full bg-background/15">
              <Icon className="size-4" />
            </span>
            <span className="space-y-1">
              <span className="block text-sm font-semibold">{option.label}</span>
              <span className={cn("block text-xs leading-5", isActive ? "text-primary-foreground/80" : "text-muted-foreground")}>
                {option.description}
              </span>
            </span>
          </Button>
        );
      })}
    </div>
  );
}
