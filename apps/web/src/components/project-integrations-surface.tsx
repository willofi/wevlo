"use client";

import { useState } from "react";

import type {
  CreateIntegrationInstallationRequest,
  CreateIntegrationProjectLinkRequest,
  ImportIntegrationProjectIssuesRequest,
  IntegrationInstallationDto,
  IntegrationProjectLinkDto,
  ProjectSummaryDto,
  SyncStatusDto,
  WorkspaceDto,
  WorkspaceMemberDto
} from "@wevlo/contracts";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle, Input, Textarea } from "@wevlo/ui-web";

import { AppShell } from "@/components/app-shell";
import { ProjectSidebarNav } from "@/components/project-sidebar-nav";
import {
  createProjectIntegrationLink,
  createWorkspaceIntegrationInstallation,
  getProjectHref,
  getProjectIntegrations,
  getWorkspaceHref,
  importProjectIntegrationIssues
} from "@/lib/issue-hub-data";

type ProjectIntegrationsSurfaceProps = {
  initialInstallations: IntegrationInstallationDto[];
  initialLinks: IntegrationProjectLinkDto[];
  initialSyncStatuses: SyncStatusDto[];
  project: ProjectSummaryDto;
  projects: ProjectSummaryDto[];
  shellViewer: {
    email?: string | null;
    name: string;
  };
  shellWorkspaces: Array<{
    name: string;
    slug: string;
  }>;
  workspace: WorkspaceDto;
  workspaceMembers: WorkspaceMemberDto[];
};

const selectClassName =
  "flex h-11 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring";

export function ProjectIntegrationsSurface({
  initialInstallations,
  initialLinks,
  initialSyncStatuses,
  project,
  projects,
  shellViewer,
  shellWorkspaces,
  workspace,
  workspaceMembers
}: ProjectIntegrationsSurfaceProps) {
  const [installations, setInstallations] = useState(initialInstallations);
  const [links, setLinks] = useState(initialLinks);
  const [syncStatuses, setSyncStatuses] = useState(initialSyncStatuses);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [installationProvider, setInstallationProvider] = useState<"github" | "gitlab">("github");
  const [installationForm, setInstallationForm] = useState<CreateIntegrationInstallationRequest>({
    authType: "app",
    externalAccountId: "",
    externalAccountSlug: "",
    webhookSecret: ""
  });

  const [linkProvider, setLinkProvider] = useState<"github" | "gitlab">("github");
  const [linkForm, setLinkForm] = useState<CreateIntegrationProjectLinkRequest>({
    externalProjectId: "",
    externalProjectPath: "",
    installationId: "",
    sourceOfTruth: "remote"
  });

  const [importProvider, setImportProvider] = useState<"github" | "gitlab">("github");
  const [importJson, setImportJson] = useState<string>("[]");
  const [importSummary, setImportSummary] = useState<string | null>(null);

  const refreshProjectIntegrations = async () => {
    const result = await getProjectIntegrations(workspace.slug, project.key);
    setLinks(result.links);
    setSyncStatuses(result.syncStatuses);
  };

  const handleCreateInstallation = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const installation = await createWorkspaceIntegrationInstallation(
        workspace.slug,
        installationProvider,
        installationForm
      );
      setInstallations((current) => [...current.filter((candidate) => candidate.id !== installation.id), installation]);
      setLinkForm((current) => ({
        ...current,
        installationId: current.installationId || installation.id
      }));
      setInstallationForm({
        authType: installationProvider === "github" ? "app" : "token",
        externalAccountId: "",
        externalAccountSlug: "",
        webhookSecret: ""
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Integration installation creation failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleCreateLink = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const link = await createProjectIntegrationLink(workspace.slug, project.key, linkProvider, linkForm);
      setLinks((current) => [...current.filter((candidate) => candidate.id !== link.id), link]);
      await refreshProjectIntegrations();
      setLinkForm({
        externalProjectId: "",
        externalProjectPath: "",
        installationId: linkForm.installationId,
        sourceOfTruth: "remote"
      });
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Integration project link creation failed");
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async () => {
    try {
      setIsSaving(true);
      setError(null);
      const payload = JSON.parse(importJson) as ImportIntegrationProjectIssuesRequest["issues"];
      const response = await importProjectIntegrationIssues(workspace.slug, project.key, importProvider, {
        issues: payload
      });
      setImportSummary(`Imported ${response.importedCount} issue${response.importedCount === 1 ? "" : "s"} from ${importProvider}.`);
      await refreshProjectIntegrations();
    } catch (importError) {
      setError(importError instanceof Error ? importError.message : "Integration import failed");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell
      viewer={shellViewer}
      workspaces={shellWorkspaces}
      currentWorkspaceSlug={workspace.slug}
      title={`${project.key} integrations`}
      subtitle={`${workspace.name} workspace sync settings for ${project.name}`}
      breadcrumbs={[
        { label: "Home", href: "/" },
        { label: workspace.name, href: getWorkspaceHref(workspace.slug) },
        { label: project.key, href: getProjectHref(workspace.slug, project.key) },
        { label: "Integrations" }
      ]}
      workspaceActionsContext={{
        currentProjectKey: project.key,
        projects,
        workspaceMembers,
        workspaceSlug: workspace.slug
      }}
      sidebar={<ProjectSidebarNav mode="integrations" project={project} projects={projects} workspace={workspace} />}
    >
      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="grid gap-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Add installation</CardTitle>
              <CardDescription>Register a GitHub App or GitLab token installation at the workspace level.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <select
                value={installationProvider}
                onChange={(event) => setInstallationProvider(event.target.value as "github" | "gitlab")}
                className={selectClassName}
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
              </select>
              <select
                value={installationForm.authType}
                onChange={(event) =>
                  setInstallationForm((current) => ({
                    ...current,
                    authType: event.target.value as CreateIntegrationInstallationRequest["authType"]
                  }))
                }
                className={selectClassName}
              >
                <option value="app">App</option>
                <option value="oauth">OAuth</option>
                <option value="token">Token</option>
              </select>
              <Input
                value={installationForm.externalAccountId}
                onChange={(event) =>
                  setInstallationForm((current) => ({
                    ...current,
                    externalAccountId: event.target.value
                  }))
                }
                placeholder="External account ID"
              />
              <Input
                value={installationForm.externalAccountSlug ?? ""}
                onChange={(event) =>
                  setInstallationForm((current) => ({
                    ...current,
                    externalAccountSlug: event.target.value
                  }))
                }
                placeholder="External account slug"
              />
              <Input
                value={installationForm.webhookSecret ?? ""}
                onChange={(event) =>
                  setInstallationForm((current) => ({
                    ...current,
                    webhookSecret: event.target.value
                  }))
                }
                placeholder="Webhook secret"
                type="password"
              />
              <Button onClick={() => void handleCreateInstallation()} disabled={isSaving || installationForm.externalAccountId.trim().length === 0}>
                {isSaving ? "Saving..." : "Create installation"}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Link project</CardTitle>
              <CardDescription>Bind this Wevlo project to one external GitHub repository or GitLab project.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <select
                value={linkProvider}
                onChange={(event) => setLinkProvider(event.target.value as "github" | "gitlab")}
                className={selectClassName}
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
              </select>
              <select
                value={linkForm.installationId}
                onChange={(event) =>
                  setLinkForm((current) => ({
                    ...current,
                    installationId: event.target.value
                  }))
                }
                className={selectClassName}
              >
                <option value="">Choose installation</option>
                {installations
                  .filter((installation) => installation.provider === linkProvider)
                  .map((installation) => (
                    <option key={installation.id} value={installation.id}>
                      {installation.provider} · {installation.externalAccountSlug ?? installation.externalAccountId}
                    </option>
                  ))}
              </select>
              <Input
                value={linkForm.externalProjectId}
                onChange={(event) =>
                  setLinkForm((current) => ({
                    ...current,
                    externalProjectId: event.target.value
                  }))
                }
                placeholder="External project ID"
              />
              <Input
                value={linkForm.externalProjectPath}
                onChange={(event) =>
                  setLinkForm((current) => ({
                    ...current,
                    externalProjectPath: event.target.value
                  }))
                }
                placeholder="External project path"
              />
              <select
                value={linkForm.sourceOfTruth}
                onChange={(event) =>
                  setLinkForm((current) => ({
                    ...current,
                    sourceOfTruth: event.target.value as CreateIntegrationProjectLinkRequest["sourceOfTruth"]
                  }))
                }
                className={selectClassName}
              >
                <option value="remote">Remote source of truth</option>
                <option value="shared">Shared source of truth</option>
              </select>
              <Button
                onClick={() => void handleCreateLink()}
                disabled={
                  isSaving ||
                  linkForm.installationId.trim().length === 0 ||
                  linkForm.externalProjectId.trim().length === 0 ||
                  linkForm.externalProjectPath.trim().length === 0
                }
              >
                {isSaving ? "Saving..." : "Create project link"}
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Import issues</CardTitle>
              <CardDescription>Paste a sanitized array of canonical remote issues to bootstrap import or replay fixtures.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <select
                value={importProvider}
                onChange={(event) => setImportProvider(event.target.value as "github" | "gitlab")}
                className={selectClassName}
              >
                <option value="github">GitHub</option>
                <option value="gitlab">GitLab</option>
              </select>
              <Textarea
                value={importJson}
                onChange={(event) => setImportJson(event.target.value)}
                placeholder='[{"externalId":"1","externalProjectId":"123","title":"Broken sync","description":"","state":"open","authorId":"octocat","comments":[]}]'
                className="min-h-52"
              />
              <Button onClick={() => void handleImport()} disabled={isSaving}>
                {isSaving ? "Importing..." : "Import issues"}
              </Button>
              {importSummary ? <div className="text-sm text-muted-foreground">{importSummary}</div> : null}
            </CardContent>
          </Card>
          {error ? <div className="rounded-lg border border-destructive/35 bg-destructive/10 px-3 py-2 text-sm text-destructive">{error}</div> : null}
        </div>

        <div className="grid gap-6">
          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Workspace installations</CardTitle>
              <CardDescription>Reusable provider installations available inside {workspace.slug}.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {installations.length === 0 ? (
                <div className="text-sm text-muted-foreground">No installations yet.</div>
              ) : (
                installations.map((installation) => (
                  <div key={installation.id} className="rounded-lg border border-border/70 bg-background/55 p-4">
                    <div className="text-sm font-semibold">{installation.provider}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {installation.externalAccountSlug ?? installation.externalAccountId}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                      {installation.authType} · {installation.status}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Project links</CardTitle>
              <CardDescription>Active external sources currently mapped into {project.key}.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {links.length === 0 ? (
                <div className="text-sm text-muted-foreground">No linked external projects yet.</div>
              ) : (
                links.map((link) => (
                  <div key={link.id} className="rounded-lg border border-border/70 bg-background/55 p-4">
                    <div className="text-sm font-semibold">{link.provider} · {link.externalProjectPath}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Source of truth: {link.sourceOfTruth}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Last import: {link.lastImportedAt ? new Date(link.lastImportedAt).toLocaleString() : "Never"}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Last webhook: {link.lastWebhookReceivedAt ? new Date(link.lastWebhookReceivedAt).toLocaleString() : "Never"}
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          <Card className="shadow-none">
            <CardHeader>
              <CardTitle>Sync status</CardTitle>
              <CardDescription>Latest webhook/import processing state per linked provider.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-3">
              {syncStatuses.length === 0 ? (
                <div className="text-sm text-muted-foreground">No sync activity yet.</div>
              ) : (
                syncStatuses.map((status) => (
                  <div key={status.projectLinkId} className="rounded-lg border border-border/70 bg-background/55 p-4">
                    <div className="text-sm font-semibold">{status.provider}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Pending deliveries: {status.pendingDeliveryCount}
                    </div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      Last processed: {status.lastProcessedAt ? new Date(status.lastProcessedAt).toLocaleString() : "Never"}
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] text-muted-foreground">{status.status}</div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
