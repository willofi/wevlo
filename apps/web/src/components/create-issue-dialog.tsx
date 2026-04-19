"use client";

import { useState, useTransition } from "react";

import type { IssueDetailDto } from "@wevlo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Textarea
} from "@wevlo/ui-web";

import { createIssue } from "@/lib/issue-hub-data";

type CreateIssueDialogProps = {
  onCreated: (issue: IssueDetailDto) => void;
  onOpenChange: (open: boolean) => void;
  open: boolean;
  projectKey: string;
  workspaceSlug: string;
};

export function CreateIssueDialog({
  onCreated,
  onOpenChange,
  open,
  projectKey,
  workspaceSlug
}: CreateIssueDialogProps) {
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const reset = () => {
    setTitle("");
    setDescription("");
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
          const created = await createIssue(workspaceSlug, projectKey, {
            description,
            title
          });

          reset();
          onCreated(created);
        } catch (submitError) {
          setError(submitError instanceof Error ? submitError.message : "Issue creation failed.");
        }
      })();
    });
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>New issue</DialogTitle>
          <DialogDescription>
            Capture the task first. We can enrich fields after the issue exists.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="issue-title">Title</Label>
            <Input
              id="issue-title"
              value={title}
              placeholder="Make project shell easier to scan"
              onChange={(event) => setTitle(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor="issue-description">Description</Label>
            <Textarea
              id="issue-description"
              value={description}
              placeholder="Context, acceptance notes, or linked discussions."
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          {error ? <div className="text-sm text-destructive">{error}</div> : null}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button disabled={isPending || title.trim().length === 0} onClick={handleSubmit}>
            {isPending ? "Creating..." : "Create issue"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
