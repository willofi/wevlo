"use client";

import { AtSign, Camera, Trash2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";

import type { UserDto } from "@wevlo/contracts";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Input,
  cn
} from "@wevlo/ui-web";

import {
  getHandleAvailability,
  removeProfileAvatar,
  updateProfile,
  uploadProfileAvatar
} from "@/lib/issue-hub-data";
import { isRequestStatus } from "@/lib/request-error";

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

type ProfileEditorFormProps = {
  description: string;
  redirectToOnSave?: string;
  showEmail?: boolean;
  showHandle?: boolean;
  submitLabel: string;
  submitNote: string;
  successMessage: string;
  title: string;
  user: UserDto;
};

function initialsFromName(name: string, email?: string | null) {
  const source = name.trim().length > 0 ? name : (email ?? "User");

  return source
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

export function ProfileEditorForm({
  description,
  redirectToOnSave,
  showEmail = true,
  showHandle = true,
  submitLabel,
  submitNote,
  successMessage,
  title,
  user
}: ProfileEditorFormProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [name, setName] = useState(user.name);
  const [handle, setHandle] = useState(user.handle);
  const [savedUser, setSavedUser] = useState(user);
  const [handleStatus, setHandleStatus] = useState<HandleStatus>({ tone: "idle" });
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isSaving, startSaveTransition] = useTransition();
  const initials = useMemo(
    () => initialsFromName(name || savedUser.name, savedUser.email),
    [name, savedUser.email, savedUser.name]
  );

  useEffect(() => {
    setName(user.name);
    setHandle(user.handle);
    setSavedUser(user);
    setHandleStatus({ tone: "idle" });
  }, [user]);

  const normalizedHandle = handle.trim().toLowerCase();
  const hasChanges =
    name.trim() !== savedUser.name ||
    (showHandle && normalizedHandle !== savedUser.handle);

  const validateHandle = () => {
    if (!showHandle) {
      return true;
    }

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
    if (!showHandle) {
      return;
    }

    const nextHandle = normalizedHandle;

    if (nextHandle.length === 0 || nextHandle === savedUser.handle) {
      setHandleStatus({ tone: "idle" });
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

  const applySavedUser = (nextUser: UserDto) => {
    setSavedUser(nextUser);
    setName(nextUser.name);
    setHandle(nextUser.handle);
    setSaveError(null);
    setSaveMessage(successMessage);
  };

  const handleAvatarUpload = async (file: File) => {
    setIsUploadingAvatar(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const updatedUser = await uploadProfileAvatar(file);
      applySavedUser(updatedUser);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Profile image upload failed.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleAvatarRemove = async () => {
    setIsUploadingAvatar(true);
    setSaveError(null);
    setSaveMessage(null);

    try {
      const updatedUser = await removeProfileAvatar();
      applySavedUser(updatedUser);
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Profile image removal failed.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleSave = () => {
    const trimmedName = name.trim();
    const nextHandle = normalizedHandle;

    setSaveError(null);
    setSaveMessage(null);

    if (trimmedName.length === 0) {
      setSaveError("Full name cannot be empty.");
      return;
    }

    if (showHandle && !handlePattern.test(nextHandle)) {
      validateHandle();
      return;
    }

    startSaveTransition(() => {
      void (async () => {
        try {
          const updatedUser = await updateProfile({
            ...(showHandle ? { handle: nextHandle } : {}),
            name: trimmedName
          });
          applySavedUser(updatedUser);
          setHandleStatus(
            showHandle
              ? {
                  message: "Mention name updated.",
                  tone: "available"
                }
              : { tone: "idle" }
          );
          router.refresh();

          if (redirectToOnSave) {
            router.push(redirectToOnSave);
          }
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
        <h1 className="text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">{title}</h1>
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{description}</p>
      </div>

      <Card className="rounded-[28px] border-border/70 shadow-none">
        <CardHeader className="space-y-2">
          <CardTitle>Profile details</CardTitle>
          <CardDescription>
            Your name, avatar, and mention handle show up across comments, assignees, and workspace member lists.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-0">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];

              if (file) {
                void handleAvatarUpload(file);
              }

              event.currentTarget.value = "";
            }}
          />

          <FieldRow label="Profile picture">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-4">
                <Avatar className="size-14 bg-secondary">
                  {savedUser.avatarUrl ? <AvatarImage src={savedUser.avatarUrl} alt={savedUser.name || savedUser.email || "User"} /> : null}
                  <AvatarFallback className="bg-primary text-sm font-semibold text-primary-foreground">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-1">
                  <div className="text-sm font-medium text-foreground">
                    {savedUser.avatarUrl ? "Current profile image" : "Start with initials and add a photo when ready."}
                  </div>
                  <p className="text-sm leading-6 text-muted-foreground">
                    Upload a PNG, JPG, WEBP, or GIF up to 5 MB. Google profile photos stay until you replace them.
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 self-start sm:self-auto">
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2"
                  disabled={isUploadingAvatar}
                  onClick={() => fileInputRef.current?.click()}
                >
                  {savedUser.avatarUrl ? <Camera className="size-4" /> : <Upload className="size-4" />}
                  {isUploadingAvatar ? "Uploading..." : savedUser.avatarUrl ? "Change image" : "Upload image"}
                </Button>
                {savedUser.avatarUrl ? (
                  <Button
                    type="button"
                    variant="ghost"
                    className="gap-2"
                    disabled={isUploadingAvatar}
                    onClick={() => void handleAvatarRemove()}
                  >
                    <Trash2 className="size-4" />
                    Remove
                  </Button>
                ) : null}
              </div>
            </div>
          </FieldRow>

          {showEmail ? (
            <FieldRow
              label="Email"
              description="Managed by your sign-in provider. Keeping this locked avoids drifting away from the authenticated identity source."
            >
              <div className="space-y-3">
                <Input value={savedUser.email ?? "No email available"} readOnly aria-readonly="true" className="h-11 rounded-2xl bg-secondary/35" />
              </div>
            </FieldRow>
          ) : null}

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
                This is what teammates see in project lists, assignee chips, comments, and membership surfaces.
              </div>
            </div>
          </FieldRow>

          {showHandle ? (
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
                      setHandleStatus({ tone: "idle" });
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
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          {saveError ? <div className="text-sm font-medium text-destructive">{saveError}</div> : null}
          {!saveError && saveMessage ? <div className="text-sm font-medium text-emerald-600 dark:text-emerald-400">{saveMessage}</div> : null}
          <div className="text-xs leading-5 text-muted-foreground">{submitNote}</div>
        </div>
        <Button type="button" onClick={handleSave} disabled={!hasChanges || isSaving} className="min-w-32 rounded-full">
          {isSaving ? "Saving..." : submitLabel}
        </Button>
      </div>
    </div>
  );
}
