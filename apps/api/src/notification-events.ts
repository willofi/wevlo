import type { IssueCommentDto, IssueDetailDto, IssueMentionDto, WorkspaceInvitationDto, WorkspaceMemberDto } from "@wevlo/contracts";
import type { NotificationCategory, NotificationEventType } from "@wevlo/contracts";
import type { NotificationDeliveryPlan, NotificationOutboxEnvelope } from "@wevlo/notifications";

const buildIssueHref = (workspaceSlug: string, projectKey: string, issueKey: string) =>
  `/${workspaceSlug}/${projectKey}/issues/${encodeURIComponent(issueKey)}`;

const buildCommentHref = (workspaceSlug: string, projectKey: string, issueKey: string, commentId: string) =>
  `${buildIssueHref(workspaceSlug, projectKey, issueKey)}?comment=${encodeURIComponent(commentId)}#comment-${encodeURIComponent(commentId)}`;

const buildDescriptionHref = (
  workspaceSlug: string,
  projectKey: string,
  issueKey: string,
  mention: IssueDetailDto["descriptionMentions"][number]
) =>
  `${buildIssueHref(workspaceSlug, projectKey, issueKey)}?target=description&start=${mention.startOffset}&end=${mention.endOffset}#description`;

const excerpt = (body: string) => {
  const compact = body.replace(/\s+/g, " ").trim();
  return compact.length <= 140 ? compact : `${compact.slice(0, 137)}...`;
};

const createDelivery = (input: NotificationDeliveryPlan): NotificationDeliveryPlan => input;

const createEvent = (input: NotificationOutboxEnvelope): NotificationOutboxEnvelope => input;

export const buildWorkspaceInvitationReceivedEvent = (input: {
  invitation: WorkspaceInvitationDto;
  recipientUserId: string;
  workspaceName: string;
  workspaceSlug: string;
}): NotificationOutboxEnvelope =>
  createEvent({
    actorUserId: input.invitation.invitedByUserId,
    aggregateId: input.invitation.id,
    aggregateType: "workspace_invitation",
    eventType: "workspace_invitation_received",
    invitationId: input.invitation.id,
    payload: {
      deliveries: [
        createDelivery({
          body: `${input.workspaceName} invited you to join as ${input.invitation.role}.`,
          category: "invitations",
          dedupeKey: `workspace_invitation_received:${input.invitation.id}:${input.recipientUserId}`,
          eventType: "workspace_invitation_received",
          href: `/invite/${encodeURIComponent(input.invitation.acceptToken ?? input.invitation.id)}`,
          invitationId: input.invitation.id,
          mandatory: true,
          payload: {
            invitationId: input.invitation.id,
            workspaceSlug: input.workspaceSlug
          },
          recipientUserId: input.recipientUserId,
          title: "Workspace invitation",
          workspaceId: input.invitation.workspaceId
        })
      ]
    },
    workspaceId: input.invitation.workspaceId
  });

export const buildWorkspaceInvitationAcceptedEvent = (input: {
  acceptedByName: string;
  actorUserId: string;
  invitation: WorkspaceInvitationDto;
  workspaceName: string;
  workspaceSlug: string;
}): NotificationOutboxEnvelope | null => {
  if (input.invitation.invitedByUserId === input.actorUserId) {
    return null;
  }

  return createEvent({
    actorUserId: input.actorUserId,
    aggregateId: input.invitation.id,
    aggregateType: "workspace_invitation",
    eventType: "workspace_invitation_accepted",
    invitationId: input.invitation.id,
    payload: {
      deliveries: [
        createDelivery({
          body: `${input.acceptedByName} accepted the workspace invite to ${input.workspaceName}.`,
          category: "invitations",
          dedupeKey: `workspace_invitation_accepted:${input.invitation.id}:${input.invitation.invitedByUserId}`,
          eventType: "workspace_invitation_accepted",
          href: `/${input.workspaceSlug}/members`,
          invitationId: input.invitation.id,
          payload: {
            invitationId: input.invitation.id,
            workspaceSlug: input.workspaceSlug
          },
          recipientUserId: input.invitation.invitedByUserId,
          title: "Workspace invite accepted",
          workspaceId: input.invitation.workspaceId
        })
      ]
    },
    workspaceId: input.invitation.workspaceId
  });
};

export const buildProjectInvitationReceivedEvent = (input: {
  invitation: WorkspaceInvitationDto;
  projectKey: string;
  recipientUserId: string;
  workspaceSlug: string;
}): NotificationOutboxEnvelope =>
  createEvent({
    actorUserId: input.invitation.invitedByUserId,
    aggregateId: input.invitation.id,
    aggregateType: "project_invitation",
    eventType: "project_invitation_received",
    invitationId: input.invitation.id,
    issueId: null,
    payload: {
      deliveries: [
        createDelivery({
          body: `${input.projectKey} invited you to join this project as ${input.invitation.role}.`,
          category: "invitations",
          dedupeKey: `project_invitation_received:${input.invitation.id}:${input.recipientUserId}`,
          eventType: "project_invitation_received",
          href: `/invite/${encodeURIComponent(input.invitation.acceptToken ?? input.invitation.id)}`,
          invitationId: input.invitation.id,
          mandatory: true,
          payload: {
            invitationId: input.invitation.id,
            projectKey: input.projectKey,
            workspaceSlug: input.workspaceSlug
          },
          projectId: input.invitation.projectId,
          recipientUserId: input.recipientUserId,
          title: "Project invitation",
          workspaceId: input.invitation.workspaceId
        })
      ]
    },
    projectId: input.invitation.projectId,
    workspaceId: input.invitation.workspaceId
  });

export const buildProjectInvitationAcceptedEvent = (input: {
  acceptedByName: string;
  actorUserId: string;
  invitation: WorkspaceInvitationDto;
  projectKey: string;
  workspaceSlug: string;
}): NotificationOutboxEnvelope | null => {
  if (input.invitation.invitedByUserId === input.actorUserId) {
    return null;
  }

  return createEvent({
    actorUserId: input.actorUserId,
    aggregateId: input.invitation.id,
    aggregateType: "project_invitation",
    eventType: "project_invitation_accepted",
    invitationId: input.invitation.id,
    payload: {
      deliveries: [
        createDelivery({
          body: `${input.acceptedByName} accepted the invite to ${input.projectKey}.`,
          category: "invitations",
          dedupeKey: `project_invitation_accepted:${input.invitation.id}:${input.invitation.invitedByUserId}`,
          eventType: "project_invitation_accepted",
          href: `/${input.workspaceSlug}/${input.projectKey}/access`,
          invitationId: input.invitation.id,
          payload: {
            invitationId: input.invitation.id,
            projectKey: input.projectKey,
            workspaceSlug: input.workspaceSlug
          },
          projectId: input.invitation.projectId,
          recipientUserId: input.invitation.invitedByUserId,
          title: "Project invite accepted",
          workspaceId: input.invitation.workspaceId
        })
      ]
    },
    projectId: input.invitation.projectId,
    workspaceId: input.invitation.workspaceId
  });
};

export const buildProjectInvitationRevokedEvent = (input: {
  actorName: string;
  actorUserId: string;
  invitation: WorkspaceInvitationDto;
  projectKey: string;
  workspaceSlug: string;
}): NotificationOutboxEnvelope | null => {
  if (input.invitation.invitedByUserId === input.actorUserId) {
    return null;
  }

  return createEvent({
    actorUserId: input.actorUserId,
    aggregateId: input.invitation.id,
    aggregateType: "project_invitation",
    eventType: "project_invitation_revoked",
    invitationId: input.invitation.id,
    payload: {
      deliveries: [
        createDelivery({
          body: `${input.actorName} revoked the pending invite for ${input.projectKey}.`,
          category: "invitations",
          dedupeKey: `project_invitation_revoked:${input.invitation.id}:${input.invitation.invitedByUserId}`,
          eventType: "project_invitation_revoked",
          href: `/${input.workspaceSlug}/${input.projectKey}/access`,
          invitationId: input.invitation.id,
          payload: {
            invitationId: input.invitation.id,
            projectKey: input.projectKey,
            workspaceSlug: input.workspaceSlug
          },
          projectId: input.invitation.projectId,
          recipientUserId: input.invitation.invitedByUserId,
          title: "Project invite revoked",
          workspaceId: input.invitation.workspaceId
        })
      ]
    },
    projectId: input.invitation.projectId,
    workspaceId: input.invitation.workspaceId
  });
};

export const buildProjectAccessGrantedEvent = (input: {
  actorName: string;
  actorUserId: string;
  projectId: string;
  projectKey: string;
  recipientUserId: string;
  workspaceId: string;
  workspaceSlug: string;
}): NotificationOutboxEnvelope | null => {
  if (input.recipientUserId === input.actorUserId) {
    return null;
  }

  return createEvent({
    actorUserId: input.actorUserId,
    aggregateId: `${input.projectId}:${input.recipientUserId}`,
    aggregateType: "project_membership",
    eventType: "project_access_granted",
    payload: {
      deliveries: [
        createDelivery({
          body: `${input.actorName} granted you access to ${input.projectKey}.`,
          category: "access",
          dedupeKey: `project_access_granted:${input.projectId}:${input.recipientUserId}`,
          eventType: "project_access_granted",
          href: `/${input.workspaceSlug}/${input.projectKey}/access`,
          payload: {
            projectKey: input.projectKey,
            workspaceSlug: input.workspaceSlug
          },
          projectId: input.projectId,
          recipientUserId: input.recipientUserId,
          title: "Project access granted",
          workspaceId: input.workspaceId
        })
      ]
    },
    projectId: input.projectId,
    workspaceId: input.workspaceId
  });
};

export const buildIssueAssignedEvent = (input: {
  actorName: string;
  actorUserId: string;
  assigneeUserId: string;
  issue: IssueDetailDto;
  projectKey: string;
  workspaceId: string;
  workspaceSlug: string;
}): NotificationOutboxEnvelope | null => {
  if (input.assigneeUserId === input.actorUserId) {
    return null;
  }

  return createEvent({
    actorUserId: input.actorUserId,
    aggregateId: input.issue.id,
    aggregateType: "issue",
    eventType: "issue_assigned",
    issueId: input.issue.id,
    payload: {
      deliveries: [
        createDelivery({
          body: `${input.actorName} assigned ${input.issue.issueKey} to you.`,
          category: "assignments",
          dedupeKey: `issue_assigned:${input.issue.id}:${input.assigneeUserId}:${input.issue.updatedAt}`,
          eventType: "issue_assigned",
          href: buildIssueHref(input.workspaceSlug, input.projectKey, input.issue.issueKey),
          issueId: input.issue.id,
          payload: {
            issueKey: input.issue.issueKey,
            workspaceSlug: input.workspaceSlug
          },
          projectId: input.issue.projectId,
          recipientUserId: input.assigneeUserId,
          target: {
            issueKey: input.issue.issueKey,
            projectKey: input.projectKey,
            targetKind: "issue",
            workspaceSlug: input.workspaceSlug
          },
          title: "Assigned to you",
          workspaceId: input.workspaceId
        })
      ]
    },
    projectId: input.issue.projectId,
    workspaceId: input.workspaceId
  });
};

export const buildIssueCommentEvent = (input: {
  actorName: string;
  actorUserId: string;
  comment: IssueCommentDto;
  issue: IssueDetailDto;
  previousIssue: IssueDetailDto;
  projectKey: string;
  workspaceMembers: WorkspaceMemberDto[];
  workspaceSlug: string;
}): NotificationOutboxEnvelope | null => {
  const workspaceUserIds = new Set(input.workspaceMembers.map((member) => member.userId));
  const commentPreview = excerpt(input.comment.body);
  const deliveriesByUserId = new Map<string, { delivery: NotificationDeliveryPlan; rank: number }>();
  const issueContext = {
    issueKey: input.issue.issueKey,
    projectId: input.issue.projectId,
    workspaceSlug: input.workspaceSlug
  };

  const addRecipient = (
    recipientUserId: string,
    category: NotificationCategory,
    eventType: NotificationEventType,
    rank: number,
    title: string,
    body: string
  ) => {
    if (recipientUserId === input.actorUserId || !workspaceUserIds.has(recipientUserId)) {
      return;
    }

    const current = deliveriesByUserId.get(recipientUserId);

    if (current && current.rank <= rank) {
      return;
    }

    deliveriesByUserId.set(recipientUserId, {
      delivery: createDelivery({
        body,
        category,
        dedupeKey: `${eventType}:${input.comment.id}:${recipientUserId}`,
        eventType,
        href: buildCommentHref(input.workspaceSlug, input.projectKey, input.issue.issueKey, input.comment.id),
        issueId: input.issue.id,
        payload: issueContext,
        projectId: input.issue.projectId,
        recipientUserId,
        target: {
          commentId: input.comment.id,
          issueKey: input.issue.issueKey,
          projectKey: input.projectKey,
          targetKind: "comment",
          workspaceSlug: input.workspaceSlug
        },
        title,
        workspaceId: input.workspaceMembers[0]?.workspaceId ?? null
      }),
      rank
    });
  };

  for (const mention of input.comment.mentions) {
    addRecipient(
      mention.userId,
      "mentions",
      "issue_comment_mention",
      0,
      "Mentioned in a comment",
      `${input.actorName} mentioned you on ${input.issue.issueKey}: ${commentPreview}`
    );
  }

  if (input.issue.assigneeUserId) {
    addRecipient(
      input.issue.assigneeUserId,
      "comments",
      "issue_comment_assignee",
      1,
      "Comment on your assigned issue",
      `${input.actorName} commented on ${input.issue.issueKey}: ${commentPreview}`
    );
  }

  const participantIds = new Set(
    input.previousIssue.comments
      .map((comment) => comment.authorUserId)
      .filter((userId) => workspaceUserIds.has(userId))
  );

  for (const participantUserId of participantIds) {
    addRecipient(
      participantUserId,
      "comments",
      "issue_comment_participant",
      2,
      "New activity on an issue you joined",
      `${input.actorName} commented on ${input.issue.issueKey}: ${commentPreview}`
    );
  }

  if (deliveriesByUserId.size === 0) {
    return null;
  }

  return createEvent({
    actorUserId: input.actorUserId,
    aggregateId: input.comment.id,
    aggregateType: "issue_comment",
    eventType: "issue_comment_participant",
    issueId: input.issue.id,
    payload: {
      deliveries: [...deliveriesByUserId.values()].map((entry) => entry.delivery)
    },
    projectId: input.issue.projectId,
    workspaceId: input.workspaceMembers[0]?.workspaceId ?? null
  });
};

export const buildIssueDescriptionMentionEvent = (input: {
  actorName: string;
  actorUserId: string;
  issue: IssueDetailDto;
  previousMentions: IssueMentionDto[];
  projectKey: string;
  workspaceMembers: WorkspaceMemberDto[];
  workspaceSlug: string;
}): NotificationOutboxEnvelope | null => {
  const workspaceUserIds = new Set(input.workspaceMembers.map((member) => member.userId));
  const previousMentionKeys = new Set(
    input.previousMentions.map(
      (mention) => `${mention.userId}:${mention.startOffset}:${mention.endOffset}`
    )
  );
  const nextMentions = input.issue.descriptionMentions.filter(
    (mention) => !previousMentionKeys.has(`${mention.userId}:${mention.startOffset}:${mention.endOffset}`)
  );

  if (nextMentions.length === 0) {
    return null;
  }

  const deliveries = nextMentions.flatMap((mention) => {
    if (mention.userId === input.actorUserId || !workspaceUserIds.has(mention.userId)) {
      return [];
    }

    return [
      createDelivery({
        body: `${input.actorName} mentioned you in the description for ${input.issue.issueKey}.`,
        category: "mentions",
        dedupeKey: `issue_description_mention:${input.issue.id}:${mention.userId}:${mention.startOffset}:${mention.endOffset}`,
        eventType: "issue_description_mention",
        href: buildDescriptionHref(input.workspaceSlug, input.projectKey, input.issue.issueKey, mention),
        issueId: input.issue.id,
        payload: {
          issueKey: input.issue.issueKey,
          projectId: input.issue.projectId,
          workspaceSlug: input.workspaceSlug
        },
        projectId: input.issue.projectId,
        recipientUserId: mention.userId,
        target: {
          endOffset: mention.endOffset,
          issueKey: input.issue.issueKey,
          projectKey: input.projectKey,
          startOffset: mention.startOffset,
          targetKind: "description",
          workspaceSlug: input.workspaceSlug
        },
        title: "Mentioned in issue description",
        workspaceId: input.workspaceMembers[0]?.workspaceId ?? null
      })
    ];
  });

  if (deliveries.length === 0) {
    return null;
  }

  return createEvent({
    actorUserId: input.actorUserId,
    aggregateId: `${input.issue.id}:description`,
    aggregateType: "issue",
    eventType: "issue_description_mention",
    issueId: input.issue.id,
    payload: {
      deliveries
    },
    projectId: input.issue.projectId,
    workspaceId: input.workspaceMembers[0]?.workspaceId ?? null
  });
};
