"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, MoonStar, ShieldCheck, UserRound } from "lucide-react";

import type { UserDto, WorkspaceSummaryDto } from "@wevlo/contracts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  cn
} from "@wevlo/ui-web";

import { ProfileEditorForm } from "@/components/profile-editor-form";
import { ThemeModePicker } from "@/components/theme-mode-picker";
import {
  WorkspaceMembersSettingsSection,
  type WorkspaceSettingsSectionData
} from "@/components/workspace-members-settings-section";

type SettingsSection = "preferences" | "profile" | "workspace";

type SettingsPageClientProps = {
  backHref: string;
  initialSection: SettingsSection;
  initialWorkspaceSlug: string | null;
  user: UserDto;
  workspaces: WorkspaceSummaryDto[];
  workspaceSectionData: WorkspaceSettingsSectionData | null;
};

const navItems: Array<{
  description: string;
  href: string;
  icon: typeof MoonStar;
  key: SettingsSection;
  label: string;
}> = [
  {
    description: "Theme and interface behavior",
    href: "/settings?section=preferences",
    icon: MoonStar,
    key: "preferences",
    label: "Preferences"
  },
  {
    description: "Name, email, avatar, and mentions",
    href: "/settings?section=profile",
    icon: UserRound,
    key: "profile",
    label: "Profile"
  },
  {
    description: "Workspace members and permissions",
    href: "/settings?section=workspace",
    icon: ShieldCheck,
    key: "workspace",
    label: "Workspace"
  }
];

function SettingsNav({
  activeSection,
  backHref
}: {
  activeSection: SettingsSection;
  backHref: string;
}) {
  return (
    <div className="grid gap-6">
      <Link
        href={backHref}
        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Back to app
      </Link>
      <nav className="grid gap-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = item.key === activeSection;

          return (
            <Link
              key={item.key}
              href={item.href}
              className={cn(
                "rounded-2xl px-3 py-3 transition-colors",
                isActive ? "bg-secondary/80 text-foreground" : "text-muted-foreground hover:bg-secondary/55 hover:text-foreground"
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className="size-4 shrink-0" />
                <div className="min-w-0">
                  <div className="text-sm font-semibold">{item.label}</div>
                  <div className="text-xs leading-5 text-muted-foreground">{item.description}</div>
                </div>
              </div>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

function PreferencesSection() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Preferences</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Personalize how WEVLO looks before you head back into projects and inbox work.
        </p>
      </div>
      <Card className="rounded-[28px] border-border/70 shadow-none">
        <CardHeader className="space-y-2">
          <CardTitle>Theme</CardTitle>
          <CardDescription>
            Choose whether the app should stay light, stay dark, or follow the system setting automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <ThemeModePicker />
          <div className="rounded-2xl bg-secondary/45 px-4 py-3 text-sm leading-6 text-muted-foreground">
            This keeps the current app-wide preference model intact and simply moves color mode into a more permanent settings surface.
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function ProfileSection({ user }: { user: UserDto }) {
  return (
    <ProfileEditorForm
      title="Profile"
      description="Manage the identity other teammates see across comments, mentions, and shared workspace activity."
      submitLabel="Save changes"
      submitNote="Profile updates apply immediately to new activity and future mentions."
      successMessage="Profile changes saved."
      user={user}
    />
  );
}

function WorkspaceSection({
  initialWorkspaceSlug,
  workspaceSectionData,
  workspaces
}: {
  initialWorkspaceSlug: string | null;
  workspaceSectionData: WorkspaceSettingsSectionData | null;
  workspaces: WorkspaceSummaryDto[];
}) {
  const router = useRouter();

  return (
    <div className="space-y-5">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Workspace</h1>
      </div>
      <Card className="rounded-[28px] border-border/70 shadow-none">
        <CardHeader className="space-y-1 pb-4">
          <CardTitle>Workspace</CardTitle>
        </CardHeader>
        <CardContent className="space-y-5 pt-0">
          {workspaces.length === 0 ? (
            <div className="rounded-2xl bg-secondary/45 px-4 py-3 text-sm leading-6 text-muted-foreground">
              아직 접근 가능한 워크스페이스가 없어요.
            </div>
          ) : (
            <>
              <div className="grid gap-2">
                <div className="grid gap-2">
                  <label htmlFor="workspace-selector" className="text-xs font-medium text-muted-foreground">
                    Workspace 선택
                  </label>
                  <Select
                    value={initialWorkspaceSlug ?? ""}
                    onValueChange={(slug) => {
                      router.push(`/settings?section=workspace&workspaceSlug=${encodeURIComponent(slug)}`);
                    }}
                  >
                    <SelectTrigger id="workspace-selector" className="h-11 rounded-2xl bg-background/70">
                      <SelectValue placeholder="워크스페이스를 선택하세요" />
                    </SelectTrigger>
                    <SelectContent>
                      {workspaces.map((workspace) => (
                        <SelectItem key={workspace.id} value={workspace.slug}>
                          {workspace.name} ({workspace.slug})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              {workspaceSectionData ? (
                <WorkspaceMembersSettingsSection data={workspaceSectionData} />
              ) : (
                <div className="rounded-2xl bg-secondary/45 px-4 py-3 text-sm leading-6 text-muted-foreground">
                  선택한 워크스페이스 정보를 불러오지 못했어요.
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export function SettingsPageClient({
  backHref,
  initialSection,
  initialWorkspaceSlug,
  user,
  workspaces,
  workspaceSectionData
}: SettingsPageClientProps) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex min-h-screen w-full max-w-[1520px] flex-col gap-8 px-4 py-6 sm:px-6 lg:grid lg:grid-cols-[240px_minmax(0,1fr)] lg:gap-12 lg:px-8 lg:py-8">
        <aside className="space-y-5 lg:sticky lg:top-8 lg:h-fit">
          <div className="lg:hidden">
            <Link
              href={backHref}
              className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            >
              <ArrowLeft className="size-4" />
              Back to app
            </Link>
          </div>
          <div className="hidden lg:block">
            <SettingsNav activeSection={initialSection} backHref={backHref} />
          </div>
          <div className="lg:hidden">
            <div className="flex gap-2 overflow-x-auto pb-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const isActive = item.key === initialSection;

                return (
                  <Link
                    key={item.key}
                    href={item.href}
                    className={cn(
                      "inline-flex min-w-fit items-center gap-2 rounded-full px-4 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-secondary text-foreground" : "bg-secondary/45 text-muted-foreground hover:text-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </aside>

        <main className="min-w-0">
          {initialSection === "preferences" ? <PreferencesSection /> : null}
          {initialSection === "profile" ? <ProfileSection user={user} /> : null}
          {initialSection === "workspace" ? (
            <WorkspaceSection
              initialWorkspaceSlug={initialWorkspaceSlug}
              workspaceSectionData={workspaceSectionData}
              workspaces={workspaces}
            />
          ) : null}
        </main>
      </div>
    </div>
  );
}
