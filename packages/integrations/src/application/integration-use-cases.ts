import { createHmac, timingSafeEqual } from "node:crypto";

import type {
  CreateIntegrationInstallationRequest,
  CreateIntegrationProjectLinkRequest,
  ImportIntegrationProjectIssuesRequest,
  IntegrationInstallationDto,
  IntegrationProjectLinkDto,
  IntegrationProvider,
  RemoteIssueCommentDto,
  RemoteIssueDto,
  SyncStatusDto,
  WebhookDeliveryDto
} from "@wevlo/contracts";
import { createEntityId } from "@wevlo/core";
import {
  applyIssuePatch,
  createIssueComment,
  createIssueUseCase,
  transitionIssue,
  type Issue,
  type IssueRepository
} from "@wevlo/issues";

import type { IntegrationRepository } from "./integration-repository";
import {
  buildSyncStatus,
  createIntegrationInstallation,
  createIntegrationProjectLink,
  createWebhookDelivery,
  markWebhookDelivery,
  touchProjectLink,
  type CanonicalWebhookEvent,
  type IntegrationInstallation,
  type IntegrationProjectLink,
  type ProjectRef,
  type WebhookDelivery
} from "../domain/integration";

const toInstallationDto = (installation: IntegrationInstallation): IntegrationInstallationDto => ({
  authType: installation.authType,
  createdAt: installation.createdAt,
  createdByUserId: installation.createdByUserId,
  externalAccountId: installation.externalAccountId,
  externalAccountSlug: installation.externalAccountSlug,
  hasWebhookSecret: Boolean(installation.webhookSecret),
  id: installation.id,
  provider: installation.provider,
  status: installation.status,
  updatedAt: installation.updatedAt,
  workspaceId: installation.workspaceId
});

const toWebhookDeliveryDto = (delivery: WebhookDelivery): WebhookDeliveryDto => ({
  errorMessage: delivery.errorMessage,
  eventType: delivery.eventType,
  id: delivery.id,
  installationId: delivery.installationId,
  processedAt: delivery.processedAt,
  projectLinkId: delivery.projectLinkId,
  provider: delivery.provider,
  providerDeliveryId: delivery.providerDeliveryId,
  receivedAt: delivery.receivedAt,
  status: delivery.status
});

const mapRemoteState = (state: RemoteIssueDto["state"]): Issue["state"] => {
  return state === "closed" ? "done" : "todo";
};

const formatRemoteActorId = (provider: IntegrationProvider, actorId: string): string => `${provider}:${actorId}`;

const mergeSourceLink = (
  issue: Issue,
  input: {
    installationId: string;
    provider: IntegrationProvider;
    remoteIssue: RemoteIssueDto;
    sourceOfTruth: IntegrationProjectLink["sourceOfTruth"];
  }
): Issue["sourceLinks"] => {
  const nextSourceLink = {
    externalId: input.remoteIssue.externalId,
    externalKey: input.remoteIssue.externalKey,
    externalProjectId: input.remoteIssue.externalProjectId,
    externalUrl: input.remoteIssue.externalUrl,
    installationId: input.installationId,
    lastSyncedAt: new Date().toISOString(),
    provider: input.provider,
    sourceOfTruth: input.sourceOfTruth
  } as const;

  const existingIndex = issue.sourceLinks.findIndex(
    (sourceLink) =>
      sourceLink.provider === input.provider &&
      sourceLink.externalId === input.remoteIssue.externalId &&
      sourceLink.installationId === input.installationId
  );

  if (existingIndex === -1) {
    return [...issue.sourceLinks, nextSourceLink];
  }

  return issue.sourceLinks.map((sourceLink, index) => (index === existingIndex ? nextSourceLink : sourceLink));
};

const mergeRemoteComment = (issue: Issue, provider: IntegrationProvider, comment: RemoteIssueCommentDto): Issue => {
  const authorUserId = formatRemoteActorId(provider, comment.authorId);
  const alreadyExists = issue.comments.some(
    (candidate) =>
      candidate.authorUserId === authorUserId &&
      candidate.body === comment.body &&
      candidate.createdAt === comment.createdAt
  );

  if (alreadyExists) {
    return issue;
  }

  return {
    ...issue,
    comments: [
      ...issue.comments,
      {
        authorUserId,
        body: comment.body.trim(),
        createdAt: comment.createdAt,
        id: `remote_comment:${provider}:${comment.externalId}`,
        issueId: issue.id
      }
    ],
    updatedAt: new Date().toISOString()
  };
};

const applyRemoteIssue = (issue: Issue, provider: IntegrationProvider, remoteIssue: RemoteIssueDto): Issue => {
  let nextIssue = applyIssuePatch(
    issue,
    {
      description: remoteIssue.description,
      reporterUserId: formatRemoteActorId(provider, remoteIssue.authorId),
      title: remoteIssue.title
    },
    "remote"
  );

  const targetState = mapRemoteState(remoteIssue.state);

  if (nextIssue.state !== targetState) {
    nextIssue = transitionIssue(nextIssue, targetState);
  }

  for (const comment of remoteIssue.comments) {
    nextIssue = mergeRemoteComment(nextIssue, provider, comment);
  }

  return nextIssue;
};

const upsertRemoteIssue = async (input: {
  issueRepository: IssueRepository;
  projectLink: IntegrationProjectLink;
  projectRef: ProjectRef;
  provider: IntegrationProvider;
  remoteIssue: RemoteIssueDto;
}): Promise<void> => {
  const existingIssue = await input.issueRepository.findBySourceLink({
    externalId: input.remoteIssue.externalId,
    installationId: input.projectLink.installationId,
    projectId: input.projectLink.projectId,
    provider: input.provider
  });

  if (!existingIssue) {
    const created = await createIssueUseCase(input.issueRepository, {
      description: input.remoteIssue.description,
      projectId: input.projectRef.id,
      projectKey: input.projectRef.key,
      reporterUserId: formatRemoteActorId(input.provider, input.remoteIssue.authorId),
      sourceLinks: [
        {
          externalId: input.remoteIssue.externalId,
          externalKey: input.remoteIssue.externalKey,
          externalProjectId: input.remoteIssue.externalProjectId,
          externalUrl: input.remoteIssue.externalUrl,
          installationId: input.projectLink.installationId,
          lastSyncedAt: new Date().toISOString(),
          provider: input.provider,
          sourceOfTruth: input.projectLink.sourceOfTruth
        }
      ],
      state: mapRemoteState(input.remoteIssue.state),
      title: input.remoteIssue.title,
      triageStatus: "pending"
    });

    let nextIssue = created as Issue;

    for (const comment of input.remoteIssue.comments) {
      nextIssue = mergeRemoteComment(nextIssue, input.provider, comment);
    }

    if (nextIssue.comments.length !== created.comments.length) {
      await input.issueRepository.save(nextIssue);
    }

    return;
  }

  const mergedIssue = applyRemoteIssue(existingIssue, input.provider, input.remoteIssue);
  const issueWithSourceLink = {
    ...mergedIssue,
    sourceLinks: mergeSourceLink(mergedIssue, {
      installationId: input.projectLink.installationId,
      provider: input.provider,
      remoteIssue: input.remoteIssue,
      sourceOfTruth: input.projectLink.sourceOfTruth
    })
  };

  await input.issueRepository.save(issueWithSourceLink);
};

const parseGithubWebhookEvents = (payload: Record<string, unknown>): CanonicalWebhookEvent[] => {
  const repository = payload.repository as { id?: number | string } | undefined;
  const issue = payload.issue as Record<string, unknown> | undefined;

  if (!issue || repository?.id === undefined) {
    return [];
  }

  const remoteIssue: RemoteIssueDto = {
    authorId: String((issue.user as { login?: string } | undefined)?.login ?? "unknown"),
    comments: [],
    description: String(issue.body ?? ""),
    externalId: String(issue.id ?? issue.number ?? "unknown"),
    externalKey: issue.number !== undefined ? `#${issue.number}` : undefined,
    externalProjectId: String(repository.id),
    externalUrl: typeof issue.html_url === "string" ? issue.html_url : undefined,
    state: issue.state === "closed" ? "closed" : "open",
    title: String(issue.title ?? "Untitled remote issue")
  };

  if (payload.comment) {
    const comment = payload.comment as Record<string, unknown>;

    return [
      {
        comment: {
          authorId: String((comment.user as { login?: string } | undefined)?.login ?? "unknown"),
          body: String(comment.body ?? ""),
          createdAt: String(comment.created_at ?? new Date().toISOString()),
          externalId: String(comment.id ?? createEntityId("remote_comment"))
        },
        kind: "comment",
        provider: "github",
        remoteIssue
      }
    ];
  }

  return [
    {
      kind: "issue",
      provider: "github",
      remoteIssue
    }
  ];
};

const parseGitlabWebhookEvents = (payload: Record<string, unknown>): CanonicalWebhookEvent[] => {
  const project = payload.project as { id?: number | string } | undefined;
  const attributes = payload.object_attributes as Record<string, unknown> | undefined;

  if (!project?.id || !attributes) {
    return [];
  }

  const issueAttributes = payload.issue as Record<string, unknown> | undefined;
  const source = issueAttributes ?? attributes;
  const remoteIssue: RemoteIssueDto = {
    authorId: String(
      (payload.user as { username?: string } | undefined)?.username ??
        (source.author_id !== undefined ? source.author_id : "unknown")
    ),
    comments: [],
    description: String(source.description ?? ""),
    externalId: String(source.id ?? source.iid ?? "unknown"),
    externalKey: source.iid !== undefined ? `#${source.iid}` : undefined,
    externalProjectId: String(project.id),
    externalUrl: typeof source.url === "string" ? source.url : undefined,
    state: source.state === "closed" ? "closed" : "open",
    title: String(source.title ?? "Untitled remote issue")
  };

  if ((payload.object_kind === "note" || payload.event_type === "note") && attributes.noteable_type === "Issue") {
    return [
      {
        comment: {
          authorId: String((payload.user as { username?: string } | undefined)?.username ?? "unknown"),
          body: String(attributes.note ?? ""),
          createdAt: String(attributes.created_at ?? new Date().toISOString()),
          externalId: String(attributes.id ?? createEntityId("remote_comment"))
        },
        kind: "comment",
        provider: "gitlab",
        remoteIssue
      }
    ];
  }

  return [
    {
      kind: "issue",
      provider: "gitlab",
      remoteIssue
    }
  ];
};

const parseWebhookEvents = (provider: IntegrationProvider, payload: Record<string, unknown>): CanonicalWebhookEvent[] => {
  return provider === "github" ? parseGithubWebhookEvents(payload) : parseGitlabWebhookEvents(payload);
};

const safeCompare = (left: string, right: string): boolean => {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return timingSafeEqual(leftBuffer, rightBuffer);
};

const verifyGithubSignature = (payload: string, signature: string | undefined, secret: string | null): boolean => {
  if (!secret || !signature?.startsWith("sha256=")) {
    return false;
  }

  const digest = createHmac("sha256", secret).update(payload).digest("hex");
  return safeCompare(`sha256=${digest}`, signature);
};

const verifyGitlabSecret = (token: string | undefined, secret: string | null): boolean => {
  if (!token || !secret) {
    return false;
  }

  return safeCompare(token, secret);
};

export const listWorkspaceInstallationsUseCase = async (
  repository: IntegrationRepository,
  workspaceId: string
): Promise<IntegrationInstallationDto[]> => {
  const installations = await repository.listWorkspaceInstallations(workspaceId);
  return installations.map(toInstallationDto);
};

export const listProjectLinksUseCase = async (
  repository: IntegrationRepository,
  projectId: string
): Promise<IntegrationProjectLinkDto[]> => repository.listProjectLinksByProjectId(projectId);

export const listProjectSyncStatusesUseCase = async (
  repository: IntegrationRepository,
  projectId: string
): Promise<SyncStatusDto[]> => repository.listProjectSyncStatuses(projectId);

export const createInstallationUseCase = async (
  repository: IntegrationRepository,
  input: CreateIntegrationInstallationRequest & {
    createdByUserId: string;
    provider: IntegrationProvider;
    workspaceId: string;
  }
): Promise<IntegrationInstallationDto> => {
  const existing = await repository.findInstallationByExternalAccount(
    input.workspaceId,
    input.provider,
    input.externalAccountId
  );

  if (existing) {
    return toInstallationDto(existing);
  }

  const installation = createIntegrationInstallation(input);
  await repository.saveInstallation(installation);
  return toInstallationDto(installation);
};

export const createProjectLinkUseCase = async (
  repository: IntegrationRepository,
  input: CreateIntegrationProjectLinkRequest & {
    projectId: string;
    provider: IntegrationProvider;
  }
): Promise<IntegrationProjectLinkDto> => {
  const existing = await repository.findProjectLinkByProjectAndProvider(input.projectId, input.provider);

  if (existing) {
    return existing;
  }

  const projectLink = createIntegrationProjectLink(input);
  await repository.saveProjectLink(projectLink);
  return projectLink;
};

export const importRemoteIssuesUseCase = async (input: {
  issueRepository: IssueRepository;
  issues: ImportIntegrationProjectIssuesRequest["issues"];
  projectId: string;
  provider: IntegrationProvider;
  repository: IntegrationRepository;
}): Promise<{
  importedCount: number;
  projectLink: IntegrationProjectLinkDto;
}> => {
  const projectLink = await input.repository.findProjectLinkByProjectAndProvider(input.projectId, input.provider);

  if (!projectLink) {
    throw new Error(`Integration project link not found: ${input.projectId}/${input.provider}`);
  }

  const projectRef = await input.repository.findProjectRef(input.projectId);

  if (!projectRef) {
    throw new Error(`Project not found: ${input.projectId}`);
  }

  for (const remoteIssue of input.issues) {
    await upsertRemoteIssue({
      issueRepository: input.issueRepository,
      projectLink,
      projectRef,
      provider: input.provider,
      remoteIssue
    });
  }

  const touchedProjectLink = touchProjectLink(projectLink, {
    lastImportedAt: new Date().toISOString()
  });
  await input.repository.saveProjectLink(touchedProjectLink);

  return {
    importedCount: input.issues.length,
    projectLink: touchedProjectLink
  };
};

export const receiveWebhookDeliveryUseCase = async (input: {
  body: string;
  eventType: string;
  headers: Record<string, string | undefined>;
  provider: IntegrationProvider;
  repository: IntegrationRepository;
}): Promise<WebhookDeliveryDto> => {
  const parsedPayload = JSON.parse(input.body) as Record<string, unknown>;
  let installation: IntegrationInstallation | null = null;

  if (input.provider === "github") {
    const installationId = (parsedPayload.installation as { id?: string | number } | undefined)?.id;

    if (installationId !== undefined) {
      installation = await input.repository.findInstallationByExternalAccount(
        "",
        input.provider,
        String(installationId)
      );
    }
  } else {
    const token = input.headers["x-gitlab-token"];

    if (token) {
      installation = await input.repository.findInstallationByWebhookSecret(input.provider, token);
    }
  }

  if (input.provider === "github") {
    const signature = input.headers["x-hub-signature-256"];
    const token = input.headers["x-wevlo-webhook-token"];
    const valid =
      verifyGithubSignature(input.body, signature, installation?.webhookSecret ?? null) ||
      verifyGitlabSecret(token, installation?.webhookSecret ?? null);

    if (!valid) {
      throw new Error("Invalid GitHub webhook signature");
    }
  } else if (!verifyGitlabSecret(input.headers["x-gitlab-token"], installation?.webhookSecret ?? null)) {
    throw new Error("Invalid GitLab webhook token");
  }

  const externalProjectId =
    input.provider === "github"
      ? String(((parsedPayload.repository as { id?: number | string } | undefined)?.id ?? ""))
      : String(((parsedPayload.project as { id?: number | string } | undefined)?.id ?? ""));
  const projectLink =
    externalProjectId.length > 0
      ? await input.repository.findProjectLinkByExternalProject(input.provider, externalProjectId)
      : null;
  const providerDeliveryId =
    input.headers[input.provider === "github" ? "x-github-delivery" : "x-gitlab-event-uuid"] ??
    `${input.provider}:${createEntityId("delivery")}`;

  const existing = await input.repository.findWebhookDeliveryByProviderDeliveryId(input.provider, providerDeliveryId);

  if (existing) {
    return toWebhookDeliveryDto(existing);
  }

  const delivery = createWebhookDelivery({
    eventType: input.eventType,
    installationId: installation?.id ?? projectLink?.installationId ?? null,
    payload: input.body,
    projectLinkId: projectLink?.id ?? null,
    provider: input.provider,
    providerDeliveryId
  });

  await input.repository.saveWebhookDelivery(delivery);

  if (projectLink) {
    await input.repository.saveProjectLink(
      touchProjectLink(projectLink, {
        lastWebhookReceivedAt: delivery.receivedAt
      })
    );
  }

  return toWebhookDeliveryDto(delivery);
};

export const processPendingWebhookDeliveriesUseCase = async (input: {
  issueRepository: IssueRepository;
  limit?: number;
  repository: IntegrationRepository;
}): Promise<number> => {
  const deliveries = await input.repository.findPendingDeliveries(input.limit ?? 25);
  let processedCount = 0;

  for (const delivery of deliveries) {
    try {
      const payload = JSON.parse(delivery.payload) as Record<string, unknown>;
      const events = parseWebhookEvents(delivery.provider, payload);

      for (const event of events) {
        const projectLink =
          (delivery.projectLinkId ? await input.repository.findProjectLinkById(delivery.projectLinkId) : null) ??
          (event.remoteIssue.externalProjectId
            ? await input.repository.findProjectLinkByExternalProject(delivery.provider, event.remoteIssue.externalProjectId)
            : null);

        if (!projectLink) {
          continue;
        }

        const projectRef = await input.repository.findProjectRef(projectLink.projectId);

        if (!projectRef) {
          continue;
        }

        await upsertRemoteIssue({
          issueRepository: input.issueRepository,
          projectLink,
          projectRef,
          provider: delivery.provider,
          remoteIssue: event.remoteIssue
        });

        if (event.kind === "comment") {
          const issue = await input.issueRepository.findBySourceLink({
            externalId: event.remoteIssue.externalId,
            installationId: projectLink.installationId,
            projectId: projectLink.projectId,
            provider: delivery.provider
          });

          if (issue) {
            const nextIssue = mergeRemoteComment(issue, delivery.provider, event.comment);
            if (nextIssue !== issue) {
              await input.issueRepository.save(nextIssue);
            }
          }
        }

        await input.repository.saveProjectLink(
          touchProjectLink(projectLink, {
            lastImportedAt: new Date().toISOString(),
            lastWebhookReceivedAt: delivery.receivedAt
          })
        );
      }

      await input.repository.saveWebhookDelivery(markWebhookDelivery(delivery, "processed"));
      processedCount += 1;
    } catch (error) {
      await input.repository.saveWebhookDelivery(
        markWebhookDelivery(
          delivery,
          "failed",
          error instanceof Error ? error.message : "Webhook processing failed"
        )
      );
    }
  }

  return processedCount;
};
