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

import { normalizeWorkspaceSlugClient } from "@/lib/client-slug";
import { createWorkspace, getWorkspaceHref, waitForWorkspaceRead } from "@/lib/issue-hub-data";

type CreateWorkspaceDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function CreateWorkspaceDialog({
  open,
  onOpenChange
}: CreateWorkspaceDialogProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const slugPreview = useMemo(
    () => normalizeWorkspaceSlugClient(slug.trim().length > 0 ? slug : name),
    [name, slug]
  );

  const reset = () => {
    setName("");
    setSlug("");
    setShowAdvanced(false);
    setError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);

    if (!nextOpen) {
      reset();
    }
  };

  const handleSubmit = () => {
    setError(null);

    startTransition(() => {
      void (async () => {
        try {
          const workspace = await createWorkspace({
            name,
            ...(showAdvanced && slug.trim().length > 0 ? { slug: normalizeWorkspaceSlugClient(slug) } : {})
          });

          await waitForWorkspaceRead(workspace.slug);
          handleOpenChange(false);
          router.push(getWorkspaceHref(workspace.slug));
          router.refresh();
        } catch (submitError) {
          setError(submitError instanceof Error ? submitError.message : "Workspace creation failed.");
        }
      })();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Create workspace</DialogTitle>
          <DialogDescription>
            Start with a company workspace, then add projects inside it.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="workspace-name">Workspace name</Label>
            <Input
              id="workspace-name"
              value={name}
              placeholder="Acme"
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="rounded-lg border border-border/80 bg-card/60 px-3 py-2 text-sm text-muted-foreground">
            URL preview: <span className="font-mono text-foreground">{slugPreview}</span>
          </div>

          <button
            type="button"
            className="w-fit text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
            onClick={() => setShowAdvanced((current) => !current)}
          >
            {showAdvanced ? "Hide slug override" : "Edit slug"}
          </button>

          {showAdvanced ? (
            <div className="grid gap-2">
              <Label htmlFor="workspace-slug">Slug</Label>
              <Input
                id="workspace-slug"
                value={slug}
                placeholder={slugPreview}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
          ) : null}

          {error ? <div className="text-sm text-destructive">{error}</div> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isPending || name.trim().length === 0} onClick={handleSubmit}>
            {isPending ? "Creating..." : "Create workspace"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
