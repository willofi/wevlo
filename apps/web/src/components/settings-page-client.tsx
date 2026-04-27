"use client";

import Link from "next/link";
import { ArrowLeft, AtSign, Camera, MoonStar, UserRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition, type ReactNode } from "react";

import type { UserDto } from "@wevlo/contracts";
import {
  Avatar,
  AvatarFallback,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  cn
} from "@wevlo/ui-web";

import { ThemeModePicker } from "@/components/theme-mode-picker";
import { getHandleAvailability, updateProfile } from "@/lib/issue-hub-data";
import { isRequestStatus } from "@/lib/request-error";

type SettingsSection = "preferences" | "profile";

type SettingsPageClientProps = {
  backHref: string;
  initialSection: SettingsSection;
  user: UserDto;
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
  }
];

const handlePattern = /^[a-z0-9_]{3,32}$/;

type HandleStatus =
  | {
      message?: string;
      tone: "idle";
    }
  | {
      message: string;
      tone: "checking" | "available" | "error";
    };

function initialsFromName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .map((token) => token[0] ?? "")
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function FieldRow({
  children,
  className,
  description,
  label
}: {
  children: ReactNode;
  className?: string;
  description?: string;
  label: string;
}) {
  return (
    <div
      className={cn(
        "grid gap-3 border-b border-border/70 py-5 last:border-b-0 last:pb-0 md:grid-cols-[minmax(0,220px)_minmax(0,1fr)] md:items-start",
        className
      )}
    >
      <div className="space-y-1 pr-4">
        <div className="text-sm font-semibold text-foreground">{label}</div>
        {description ? <p className="text-sm leading-6 text-muted-foreground">{description}</p> : null}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

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
  const router = useRouter();
  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(user.handle);
  const [savedUser, setSavedUser] = useState(user);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>({
    tone: "idle"
  });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const initials = useMemo(() => initialsFromName(name || savedUser.name), [name, savedUser.name]);

  useEffect(() => {
    setName(user.name);
    setHandle(user.handle);
    setSavedUser(user);
    setHandleStatus({
      tone: "idle"
    });
  }, [user]);

  const hasChanges = name.trim() !== savedUser.name || handle.trim() !== savedUser.handle;
  const normalizedHandle = handle.trim().toLowerCase();

  const validateHandle = () => {
    if (!handlePattern.test(normalizedHandle)) {
      setHandleStatus({
        message: "Mention name must be 3-32 characters and use lowercase letters, numbers, or underscores.",
        tone: "error"
      });
      return false;
    }

    return true;
  };

  const handleCheckAvailability = async () => {
    const nextHandle = handle.trim().toLowerCase();

    if (nextHandle.length === 0 || nextHandle === savedUser.handle) {
      setHandleStatus({
        tone: "idle"
      });
      return;
    }

    if (!validateHandle()) {
      return;
    }

    setHandleStatus({
      message: "Checking availability...",
      tone: "checking"
    });

    try {
      const response = await getHandleAvailability(nextHandle);
      setHandleStatus(
        response.available
          ? {
              message: "This mention name is available.",
              tone: "available"
            }
          : {
              message: "That mention name is already taken.",
              tone: "error"
            }
      );
    } catch {
      setHandleStatus({
        message: "Could not verify availability right now. You can still try saving.",
        tone: "error"
      });
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const nextHandle = handle.trim().toLowerCase();

    setSaveError(null);
    setSaveMessage(null);

    if (trimmedName.length === 0) {
      setSaveError("Full name cannot be empty.");
      return;
    }

    if (!handlePattern.test(nextHandle)) {
      validateHandle();
      return;
    }

    startSaveTransition(() => {
      void (async () => {
        try {
          const updatedUser = await updateProfile({
            handle: nextHandle,
            name: trimmedName
          });
          setSavedUser(updatedUser);
          setName(updatedUser.name);
          setHandle(updatedUser.handle);
          setHandleStatus({
            message: "Mention name updated.",
            tone: "available"
          });
          setSaveMessage("Profile changes saved.");
          router.refresh();
        } catch (error) {
          if (isRequestStatus(error, 409)) {
            setHandleStatus({
              message: "That mention name is already taken.",
              tone: "error"
            });
            setSaveError("Choose a different mention name and try again.");
            return;
          }

          setSaveError(error instanceof Error ? error.message : "Profile update failed.");
        }
      })();
    });
  };

  const handleToneClassName =
    handleStatus.tone === "error"
      ? "text-destructive"
      : handleStatus.tone === "available"
        ? "text-emerald-600 dark:text-emerald-400"
        : "text-muted-foreground";

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">Profile</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Manage the identity other teammates see across comments, mentions, and shared workspace activity.
        </p>
      </div>

      <Card className="rounded-[28px] border-border/70 shadow-none">
        <CardHeader className="space-y-2">
          <CardTitle>Profile details</CardTitle>
          <CardDescription>
            Your name and mention handle update immediately for new activity. Email and avatar stay read-only until account management expands.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <FieldRow label="Profile picture">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="size-14 bg-secondary">
                  <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">Image uploads are coming soon.</div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    We will add hosted avatars after storage and provider sync are in place.
                  </p>
                </div>
              </div>
              <Button type="button" variant="outline" disabled className="gap-2 self-start sm:self-auto">
                <Camera className="size-4" />
                Coming soon
              </Button>
            </div>
          </FieldRow>

          <FieldRow label="Email" description="Currently managed by your sign-in provider. Direct editing will land in a later pass.">
            <div className="space-y-3">
              <Input value={savedUser.email ?? "No email available"} readOnly aria-readonly="true" className="h-11 rounded-2xl bg-secondary/35" />
              <div className="text-xs leading-5 text-muted-foreground">
                Email changes are intentionally disabled for now to avoid drifting away from the authenticated identity source.
              </div>
            </div>
          </FieldRow>

          <FieldRow label="Full name">
            <div className="space-y-3">
              <Input
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setSaveError(null);
                  setSaveMessage(null);
                }}
                placeholder="Your full name"
                className="h-11 rounded-2xl"
              />
              <div className="text-xs leading-5 text-muted-foreground">
                This name is used in project lists, comments, assignee labels, and workspace membership surfaces.
              </div>
            </div>
          </FieldRow>

          <FieldRow
            label="Mention name"
            description="This is the unique handle teammates use with @mentions. Lowercase letters, numbers, and underscores only."
            className="last:pb-2"
          >
            <div className="space-y-3">
              <div className="relative">
                <AtSign className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={handle}
                  onBlur={() => void handleCheckAvailability()}
                  onChange={(event) => {
                    setHandle(event.target.value.toLowerCase().replace(/\s+/g, "_"));
                    setHandleStatus({
                      tone: "idle"
                    });
                    setSaveError(null);
                    setSaveMessage(null);
                  }}
                  placeholder="mention_name"
                  className="h-11 rounded-2xl pl-11"
                  autoCapitalize="none"
                  autoCorrect="off"
                  spellCheck={false}
                />
              </div>
              <div className={cn("text-xs leading-5", handleToneClassName)}>
                {handleStatus.message ?? "Used in comments, issue descriptions, and notifications when someone mentions you."}
              </div>
            </div>
          </FieldRow>
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          {saveError ? <div className="text-sm font-medium text-destructive">{saveError}</div> : null}
          {!saveError && saveMessage ? <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{saveMessage}</div> : null}
          <div className="text-xs leading-5 text-muted-foreground">
            Profile image and email stay read-only in this version while we finish the underlying account systems.
          </div>
        </div>
        <Button type="button" onClick={handleSave} disabled={!hasChanges || isSaving} className="min-w-32 rounded-full">
          {isSaving ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

export function SettingsPageClient({
  backHref,
  initialSection,
  user
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
          {initialSection === "preferences" ? <PreferencesSection /> : <ProfileSection user={user} />}
        </main>
      </div>
    </div>
  );
}
