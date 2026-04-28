"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label
} from "@wevlo/ui-web";

import { buildProjectKeyCandidatesClient, normalizeProjectKeyClient } from "@/lib/client-slug";
import { notifyError, notifySuccess } from "@/lib/action-feedback";
import { createProject, getProjectHref, waitForProjectRead } from "@/lib/issue-hub-data";

type CreateProjectDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  workspaceSlug: string;
};

export function CreateProjectDialog({
  open,
  onOpenChange,
  workspaceSlug
}: CreateProjectDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [keyOverride, setKeyOverride] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isPending, startTransition] = useTransition();

  const keyPreview = useMemo(() => {
    if (showAdvanced && keyOverride.trim().length > 0) {
      return normalizeProjectKeyClient(keyOverride);
    }

    return buildProjectKeyCandidatesClient(name)[0] ?? "PRJ";
  }, [keyOverride, name, showAdvanced]);

  const reset = () => {
    setName("");
    setKeyOverride("");
    setShowAdvanced(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      reset();
    }
  };

  const handleSubmit = () => {
    startTransition(() => {
      void (async () => {
        try {
          const project = await createProject(workspaceSlug, {
            name,
            ...(showAdvanced && keyOverride.trim().length > 0 ? { key: normalizeProjectKeyClient(keyOverride) } : {})
          });

          await waitForProjectRead(workspaceSlug, project.key);
          notifySuccess("Project created.");
          handleOpenChange(false);
          router.push(getProjectHref(workspaceSlug, project.key));
          router.refresh();
        } catch (submitError) {
          notifyError(submitError, "Project creation failed.");
        }
      })();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create project</DialogTitle>
          <DialogDescription>
            Keep the key short. It becomes the issue prefix inside this workspace.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="project-name">Project name</Label>
            <Input
              id="project-name"
              value={name}
              placeholder="Platform Hub"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="rounded-lg border border-border/80 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
            Key preview: <span className="font-mono text-foreground">{keyPreview}</span>
          </div>

          <button
            type="button"
            className="w-fit text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowAdvanced((current) => !current)}
          >
            {showAdvanced ? "Hide key override" : "Edit key"}
          </button>

          {showAdvanced ? (
            <div className="grid gap-2">
              <Label htmlFor="project-key">Project key</Label>
              <Input
                id="project-key"
                value={keyOverride}
                placeholder={keyPreview}
                onChange={(event) => setKeyOverride(event.target.value)}
              />
            </div>
          ) : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isPending || name.trim().length === 0} onClick={handleSubmit}>
            {isPending ? "Creating..." : "Create project"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
