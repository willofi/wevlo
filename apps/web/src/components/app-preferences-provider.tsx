"use client";

import { createContext, useContext, useEffect, useMemo, useState, type PropsWithChildren } from "react";

import {
  APP_PREFERENCES_COOKIE,
  defaultAppPreferences,
  normalizeAppPreferences,
  serializeAppPreferences,
  type AppPreferences
} from "@/lib/app-preferences-shared";

type AppPreferencesContextValue = {
  preferences: AppPreferences;
  setPreference: <K extends keyof AppPreferences>(key: K, value: AppPreferences[K]) => void;
  setPreferences: (nextPreferences: Partial<AppPreferences>) => void;
};

const STORAGE_KEY = "wevlo-app-preferences";

const AppPreferencesContext = createContext<AppPreferencesContextValue | null>(null);

const readStoredPreferences = (): AppPreferences => {
  if (typeof window === "undefined") {
    return defaultAppPreferences;
  }

  const stored = window.localStorage.getItem(STORAGE_KEY);

  if (stored) {
    try {
      return normalizeAppPreferences(JSON.parse(stored) as Partial<AppPreferences>);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }

  const cookieMatch = document.cookie
    .split("; ")
    .find((entry) => entry.startsWith(`${APP_PREFERENCES_COOKIE}=`));

  if (!cookieMatch) {
    return defaultAppPreferences;
  }

  const value = cookieMatch.split("=").slice(1).join("=");

  try {
    return normalizeAppPreferences(JSON.parse(decodeURIComponent(value)) as Partial<AppPreferences>);
  } catch {
    document.cookie = `${APP_PREFERENCES_COOKIE}=; path=/; max-age=0`;
    return defaultAppPreferences;
  }
};

const resolveTheme = (theme: AppPreferences["theme"]): "dark" | "light" => {
  if (theme === "dark" || theme === "light") {
    return theme;
  }

  if (typeof window === "undefined") {
    return "dark";
  }

  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
};

export function AppPreferencesProvider({ children }: PropsWithChildren) {
  const [preferences, setPreferencesState] = useState<AppPreferences>(() => readStoredPreferences());

  useEffect(() => {
    const root = document.documentElement;
    const resolvedTheme = resolveTheme(preferences.theme);

    root.dataset.theme = resolvedTheme;
    root.dataset.density = preferences.density;
    root.style.colorScheme = resolvedTheme;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(preferences));
    document.cookie = `${APP_PREFERENCES_COOKIE}=${serializeAppPreferences(preferences)}; path=/; max-age=${60 * 60 * 24 * 365}`;
  }, [preferences]);

  useEffect(() => {
    if (preferences.theme !== "system") {
      return;
    }

    const mediaQuery = window.matchMedia("(prefers-color-scheme: light)");
    const update = () => {
      document.documentElement.dataset.theme = mediaQuery.matches ? "light" : "dark";
      document.documentElement.style.colorScheme = mediaQuery.matches ? "light" : "dark";
    };

    update();
    mediaQuery.addEventListener("change", update);
    return () => mediaQuery.removeEventListener("change", update);
  }, [preferences.theme]);

  const value = useMemo<AppPreferencesContextValue>(
    () => ({
      preferences,
      setPreference: (key, value) =>
        setPreferencesState((current) => ({
          ...current,
          [key]: value
        })),
      setPreferences: (nextPreferences) =>
        setPreferencesState((current) => normalizeAppPreferences({ ...current, ...nextPreferences }))
    }),
    [preferences]
  );

  return <AppPreferencesContext.Provider value={value}>{children}</AppPreferencesContext.Provider>;
}

export const useAppPreferences = (): AppPreferencesContextValue => {
  const context = useContext(AppPreferencesContext);

  if (!context) {
    throw new Error("useAppPreferences must be used within AppPreferencesProvider");
  }

  return context;
};
