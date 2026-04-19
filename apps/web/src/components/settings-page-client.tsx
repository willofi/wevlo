"use client";

import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@wevlo/ui-web";

import { useAppPreferences } from "@/components/app-preferences-provider";

const sectionCardClassName = "shadow-none";

export function SettingsPageClient() {
  const { preferences, setPreference } = useAppPreferences();

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      <div className="grid gap-6">
        <Card className={sectionCardClassName}>
          <CardHeader>
            <CardTitle>Appearance</CardTitle>
            <CardDescription>Choose how the app feels at a glance. Theme and density apply across the workspace shell.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Theme</div>
              <div className="flex flex-wrap gap-2">
                <Button variant={preferences.theme === "system" ? "default" : "outline"} onClick={() => setPreference("theme", "system")}>
                  System
                </Button>
                <Button variant={preferences.theme === "dark" ? "default" : "outline"} onClick={() => setPreference("theme", "dark")}>
                  Dark
                </Button>
                <Button variant={preferences.theme === "light" ? "default" : "outline"} onClick={() => setPreference("theme", "light")}>
                  Light
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Density</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={preferences.density === "comfortable" ? "default" : "outline"}
                  onClick={() => setPreference("density", "comfortable")}
                >
                  Comfortable
                </Button>
                <Button
                  variant={preferences.density === "compact" ? "default" : "outline"}
                  onClick={() => setPreference("density", "compact")}
                >
                  Compact
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card className={sectionCardClassName}>
          <CardHeader>
            <CardTitle>Navigation</CardTitle>
            <CardDescription>Set how you want to land in the app and how persistent the workspace shell should feel.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="grid gap-2">
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Home landing</div>
              <div className="flex flex-wrap gap-2">
                <Button
                  variant={preferences.homeView === "workspace-chooser" ? "default" : "outline"}
                  onClick={() => setPreference("homeView", "workspace-chooser")}
                >
                  Workspace chooser
                </Button>
                <Button
                  variant={preferences.homeView === "last-workspace" ? "default" : "outline"}
                  onClick={() => setPreference("homeView", "last-workspace")}
                >
                  Last workspace
                </Button>
                <Button
                  variant={preferences.homeView === "my-issues" ? "default" : "outline"}
                  onClick={() => setPreference("homeView", "my-issues")}
                >
                  My issues
                </Button>
              </div>
            </div>
            <div className="grid gap-2">
              <div className="text-xs font-medium uppercase tracking-[0.24em] text-muted-foreground">Sidebar</div>
              <Button
                variant={preferences.sidebarCollapsed ? "outline" : "default"}
                onClick={() => setPreference("sidebarCollapsed", !preferences.sidebarCollapsed)}
                className="w-fit"
              >
                {preferences.sidebarCollapsed ? "Keep collapsed by default" : "Keep expanded by default"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-6">
        <Card className={sectionCardClassName}>
          <CardHeader>
            <CardTitle>Issue defaults</CardTitle>
            <CardDescription>Decide which issue scope should open first when you enter a project.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4">
            <div className="flex flex-wrap gap-2">
              <Button
                variant={preferences.defaultIssueScope === "all" ? "default" : "outline"}
                onClick={() => setPreference("defaultIssueScope", "all")}
              >
                All issues
              </Button>
              <Button
                variant={preferences.defaultIssueScope === "assigned" ? "default" : "outline"}
                onClick={() => setPreference("defaultIssueScope", "assigned")}
              >
                Assigned to me
              </Button>
              <Button
                variant={preferences.defaultIssueScope === "created" ? "default" : "outline"}
                onClick={() => setPreference("defaultIssueScope", "created")}
              >
                Created by me
              </Button>
            </div>
          </CardContent>
        </Card>
        <Card className={sectionCardClassName}>
          <CardHeader>
            <CardTitle>Notifications</CardTitle>
            <CardDescription>Notification controls will land here next. This placeholder keeps the IA stable while preferences stay local-first.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-3 text-sm leading-6 text-muted-foreground">
            <div>Planned items: triage reminders, mentions, assignment changes, and quiet hours.</div>
            <div className="inline-flex w-fit items-center gap-2 rounded-full border border-border/70 bg-background/60 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em]">
              Placeholder
            </div>
          </CardContent>
        </Card>
        <Card className={sectionCardClassName}>
          <CardHeader>
            <CardTitle>Account</CardTitle>
            <CardDescription>This page is ready for profile, shortcut, and account-level preferences without mixing them into workspace administration.</CardDescription>
          </CardHeader>
          <CardContent className="text-sm leading-6 text-muted-foreground">
            Personal app settings live here. Workspace members, access rules, and project permissions stay in the current workspace or project context.
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
