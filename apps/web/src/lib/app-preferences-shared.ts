export type AppPreferences = {
  defaultIssueScope: "all" | "assigned" | "created";
  density: "compact" | "comfortable";
  homeView: "workspace-chooser" | "last-workspace" | "my-issues";
  sidebarCollapsed: boolean;
  theme: "system" | "dark" | "light";
};

export const APP_PREFERENCES_COOKIE = "wevlo_preferences";

export const defaultAppPreferences: AppPreferences = {
  defaultIssueScope: "all",
  density: "comfortable",
  homeView: "workspace-chooser",
  sidebarCollapsed: false,
  theme: "system"
};

const isTheme = (value: unknown): value is AppPreferences["theme"] =>
  value === "system" || value === "dark" || value === "light";

const isDensity = (value: unknown): value is AppPreferences["density"] =>
  value === "compact" || value === "comfortable";

const isHomeView = (value: unknown): value is AppPreferences["homeView"] =>
  value === "workspace-chooser" || value === "last-workspace" || value === "my-issues";

const isScope = (value: unknown): value is AppPreferences["defaultIssueScope"] =>
  value === "all" || value === "assigned" || value === "created";

export const normalizeAppPreferences = (input: Partial<AppPreferences> | null | undefined): AppPreferences => ({
  defaultIssueScope: isScope(input?.defaultIssueScope) ? input.defaultIssueScope : defaultAppPreferences.defaultIssueScope,
  density: isDensity(input?.density) ? input.density : defaultAppPreferences.density,
  homeView: isHomeView(input?.homeView) ? input.homeView : defaultAppPreferences.homeView,
  sidebarCollapsed: typeof input?.sidebarCollapsed === "boolean" ? input.sidebarCollapsed : defaultAppPreferences.sidebarCollapsed,
  theme: isTheme(input?.theme) ? input.theme : defaultAppPreferences.theme
});

export const serializeAppPreferences = (preferences: AppPreferences): string =>
  encodeURIComponent(JSON.stringify(preferences));

export const parseAppPreferences = (rawValue: string | undefined): AppPreferences => {
  if (!rawValue) {
    return defaultAppPreferences;
  }

  try {
    const parsed = JSON.parse(decodeURIComponent(rawValue)) as Partial<AppPreferences>;
    return normalizeAppPreferences(parsed);
  } catch {
    return defaultAppPreferences;
  }
};
