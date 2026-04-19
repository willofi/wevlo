import { describe, expect, it, vi } from "vitest";
import { createIssue, type IssueRepository } from "@wevlo/issues";
import type {
  IntegrationInstallationDto,
  IntegrationProjectLinkDto,
  RemoteIssueDto,
  SyncStatusDto
} from "@wevlo/contracts";
import type { ProjectId } from "@wevlo/core";

import {
  createInstallationUseCase,
  createProjectLinkUseCase,
  importRemoteIssuesUseCase,
  processPendingWebhookDeliveriesUseCase,
  receiveWebhookDeliveryUseCase
} from "./integration-use-cases";
import type { IntegrationRepository } from "./integration-repository";
import type { IntegrationInstallation, IntegrationProjectLink, ProjectRef, SyncCursor, WebhookDelivery } from "../domain/integration";

const makeIssueRepository = (): IssueRepository & {
  issues: Map<string, ReturnType<typeof createIssue>>;
} => {
  const issues = new Map<string, ReturnType<typeof createIssue>>();

  return {
    findByKey: vi.fn(async (projectId: string, issueKey: string) => issues.get(`${projectId}:${issueKey}`) ?? null),
    findBySourceLink: vi.fn(async (input) => {
      return (
        [...issues.values()].find(
          (issue) =>
            issue.projectId === input.projectId &&
            issue.sourceLinks.some(
              (sourceLink) =>
                sourceLink.provider === input.provider &&
                sourceLink.externalId === input.externalId &&
                (input.installationId === undefined || sourceLink.installationId === input.installationId)
            )
        ) ?? null
      );
    }),
    issues,
    listByProject: vi.fn(async (projectId: string) => [...issues.values()].filter((issue) => issue.projectId === projectId)),
    nextIssueNumber: vi.fn(async (projectId: string) => {
      const current = [...issues.values()].filter((issue) => issue.projectId === projectId).length;
      return current + 1;
    }),
    save: vi.fn(async (issue) => {
      issues.set(`${issue.projectId}:${issue.issueKey}`, issue);
    })
  };
};

const makeIntegrationRepository = (): IntegrationRepository & {
  deliveries: Map<string, WebhookDelivery>;
  installations: Map<string, IntegrationInstallation>;
  projectLinks: Map<string, IntegrationProjectLink>;
  syncCursors: Map<string, SyncCursor>;
} => {
  const installations = new Map<string, IntegrationInstallation>();
  const projectLinks = new Map<string, IntegrationProjectLink>();
  const deliveries = new Map<string, WebhookDelivery>();
  const syncCursors = new Map<string, SyncCursor>();
  const projectRef: ProjectRef = {
    id: "project_1",
    key: "CORE"
  };

  return {
    countPendingDeliveriesByProjectLinkId: vi.fn(async (projectLinkId: string) =>
      [...deliveries.values()].filter((delivery) => delivery.projectLinkId === projectLinkId && delivery.status === "pending").length
    ),
    deliveries,
    findInstallationByExternalAccount: vi.fn(async (workspaceId, provider, externalAccountId) =>
      [...installations.values()].find(
        (installation) =>
          installation.provider === provider &&
          installation.externalAccountId === externalAccountId &&
          (workspaceId.length === 0 || installation.workspaceId === workspaceId)
      ) ?? null
    ),
    findInstallationById: vi.fn(async (installationId) => installations.get(installationId) ?? null),
    findInstallationByWebhookSecret: vi.fn(async (provider, webhookSecret) =>
      [...installations.values()].find(
        (installation) => installation.provider === provider && installation.webhookSecret === webhookSecret
      ) ?? null
    ),
    findPendingDeliveries: vi.fn(async (limit) =>
      [...deliveries.values()].filter((delivery) => delivery.status === "pending").slice(0, limit)
    ),
    findProjectLinkByExternalProject: vi.fn(async (provider, externalProjectId) =>
      [...projectLinks.values()].find(
        (projectLink) => projectLink.provider === provider && projectLink.externalProjectId === externalProjectId
      ) ?? null
    ),
    findProjectLinkById: vi.fn(async (projectLinkId) => projectLinks.get(projectLinkId) ?? null),
    findProjectLinkByProjectAndProvider: vi.fn(async (projectId, provider) =>
      [...projectLinks.values()].find(
        (projectLink) => projectLink.projectId === projectId && projectLink.provider === provider
      ) ?? null
    ),
    findProjectRef: vi.fn(async (projectId) => (projectId === projectRef.id ? projectRef : null)),
    findWebhookDeliveryByProviderDeliveryId: vi.fn(async (provider, providerDeliveryId) =>
      [...deliveries.values()].find(
        (delivery) => delivery.provider === provider && delivery.providerDeliveryId === providerDeliveryId
      ) ?? null
    ),
    installations,
    listProjectLinksByProjectId: vi.fn(async (projectId) =>
      [...projectLinks.values()].filter((projectLink) => projectLink.projectId === projectId)
    ),
    listProjectSyncStatuses: vi.fn(async (projectId) => {
      const links = [...projectLinks.values()].filter((projectLink) => projectLink.projectId === projectId);
      return links.map<SyncStatusDto>((projectLink) => ({
        lastImportedAt: projectLink.lastImportedAt,
        lastProcessedAt: null,
        lastWebhookReceivedAt: projectLink.lastWebhookReceivedAt,
        pendingDeliveryCount: [...deliveries.values()].filter(
          (delivery) => delivery.projectLinkId === projectLink.id && delivery.status === "pending"
        ).length,
        projectId: projectLink.projectId,
        projectLinkId: projectLink.id,
        provider: projectLink.provider,
        status: "pending"
      }));
    }),
    listWorkspaceInstallations: vi.fn(async (workspaceId) =>
      [...installations.values()].filter((installation) => installation.workspaceId === workspaceId)
    ),
    projectLinks,
    saveInstallation: vi.fn(async (installation) => {
      installations.set(installation.id, installation);
    }),
    saveProjectLink: vi.fn(async (projectLink) => {
      projectLinks.set(projectLink.id, projectLink);
    }),
    saveSyncCursor: vi.fn(async (cursor) => {
      syncCursors.set(cursor.projectLinkId, cursor);
    }),
    saveWebhookDelivery: vi.fn(async (delivery) => {
      deliveries.set(delivery.id, delivery);
    }),
    syncCursors
  };
};

describe("integration use cases", () => {
  it("creates installations and project links", async () => {
    const repository = makeIntegrationRepository();

    const installation = await createInstallationUseCase(repository, {
      authType: "app",
      createdByUserId: "user_1",
      externalAccountId: "42",
      externalAccountSlug: "octo-org",
      provider: "github",
      webhookSecret: "secret",
      workspaceId: "workspace_1"
    });

    const link = await createProjectLinkUseCase(repository, {
      externalProjectId: "99",
      externalProjectPath: "octo-org/core",
      installationId: installation.id,
      projectId: "project_1",
      provider: "github",
      sourceOfTruth: "remote"
    });

    expect(installation.provider).toBe("github");
    expect(link.provider).toBe("github");
    expect(link.projectId).toBe("project_1");
  });

  it("imports remote issues into the canonical issue repository", async () => {
    const repository = makeIntegrationRepository();
    const issueRepository = makeIssueRepository();

    const installation = await createInstallationUseCase(repository, {
      authType: "app",
      createdByUserId: "user_1",
      externalAccountId: "42",
      externalAccountSlug: "octo-org",
      provider: "github",
      webhookSecret: "secret",
      workspaceId: "workspace_1"
    });

    await createProjectLinkUseCase(repository, {
      externalProjectId: "99",
      externalProjectPath: "octo-org/core",
      installationId: installation.id,
      projectId: "project_1",
      provider: "github",
      sourceOfTruth: "remote"
    });

    const remoteIssue: RemoteIssueDto = {
      authorId: "octocat",
      comments: [
        {
          authorId: "octocat",
          body: "First remote comment",
          createdAt: "2025-01-01T00:00:00.000Z",
          externalId: "comment_1"
        }
      ],
      description: "Import me",
      externalId: "issue_101",
      externalKey: "#101",
      externalProjectId: "99",
      externalUrl: "https://github.com/octo-org/core/issues/101",
      state: "open",
      title: "Broken sync"
    };

    const result = await importRemoteIssuesUseCase({
      issueRepository,
      issues: [remoteIssue],
      projectId: "project_1",
      provider: "github",
      repository
    });

    const importedIssue = [...issueRepository.issues.values()][0];

    expect(result.importedCount).toBe(1);
    expect(importedIssue?.title).toBe("Broken sync");
    expect(importedIssue?.triageStatus).toBe("pending");
    expect(importedIssue?.sourceLinks[0]?.provider).toBe("github");
    expect(importedIssue?.comments).toHaveLength(1);
  });

  it("accepts and de-duplicates GitLab webhook deliveries and processes them", async () => {
    const repository = makeIntegrationRepository();
    const issueRepository = makeIssueRepository();

    const installationDto: IntegrationInstallationDto = await createInstallationUseCase(repository, {
      authType: "token",
      createdByUserId: "user_1",
      externalAccountId: "group_1",
      externalAccountSlug: "group-1",
      provider: "gitlab",
      webhookSecret: "gitlab-secret",
      workspaceId: "workspace_1"
    });

    const projectLink: IntegrationProjectLinkDto = await createProjectLinkUseCase(repository, {
      externalProjectId: "123",
      externalProjectPath: "group-1/core",
      installationId: installationDto.id,
      projectId: "project_1",
      provider: "gitlab",
      sourceOfTruth: "remote"
    });

    const payload = JSON.stringify({
      object_attributes: {
        description: "Webhook imported issue",
        id: 777,
        iid: 12,
        state: "opened",
        title: "GitLab issue"
      },
      object_kind: "issue",
      project: {
        id: 123
      },
      user: {
        username: "gitlab-user"
      }
    });

    const delivery = await receiveWebhookDeliveryUseCase({
      body: payload,
      eventType: "Issue Hook",
      headers: {
        "x-gitlab-event": "Issue Hook",
        "x-gitlab-event-uuid": "delivery-1",
        "x-gitlab-token": "gitlab-secret"
      },
      provider: "gitlab",
      repository
    });

    const duplicate = await receiveWebhookDeliveryUseCase({
      body: payload,
      eventType: "Issue Hook",
      headers: {
        "x-gitlab-event": "Issue Hook",
        "x-gitlab-event-uuid": "delivery-1",
        "x-gitlab-token": "gitlab-secret"
      },
      provider: "gitlab",
      repository
    });

    const processedCount = await processPendingWebhookDeliveriesUseCase({
      issueRepository,
      repository
    });

    const importedIssue = [...issueRepository.issues.values()][0];

    expect(delivery.id).toBe(duplicate.id);
    expect(projectLink.projectId).toBe("project_1");
    expect(processedCount).toBe(1);
    expect(importedIssue?.title).toBe("GitLab issue");
    expect(importedIssue?.sourceLinks[0]?.externalProjectId).toBe("123");
  });
});
