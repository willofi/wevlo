import {
  createInvitationToken,
  createWorkspaceInvitationId,
  type ProjectId,
  type WorkspaceId
} from "@wevlo/core";

import type { WorkspaceInvitationDto, WorkspaceRole } from "@wevlo/contracts";

export type WorkspaceInvitation = WorkspaceInvitationDto;

export const createWorkspaceInvitation = (input: {
  inviteeEmail?: string | null;
  inviteeUserId?: string | null;
  invitedByUserId: string;
  projectId?: ProjectId | null;
  role: WorkspaceRole;
  workspaceId: WorkspaceId;
}): WorkspaceInvitation => ({
  acceptToken: createInvitationToken(),
  acceptedAt: null,
  acceptedByUserId: null,
  createdAt: new Date().toISOString(),
  expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
  id: createWorkspaceInvitationId(),
  inviteeEmail: input.inviteeEmail ?? null,
  inviteeUserId: input.inviteeUserId ?? null,
  invitedByUserId: input.invitedByUserId,
  projectId: input.projectId ?? null,
  role: input.role,
  sendAttemptCount: 0,
  status: "pending",
  lastSendError: null,
  updatedAt: new Date().toISOString(),
  workspaceId: input.workspaceId
});

export const acceptWorkspaceInvitation = (
  invitation: WorkspaceInvitation,
  acceptedByUserId: string
): WorkspaceInvitation => ({
  ...invitation,
  acceptToken: null,
  acceptedAt: new Date().toISOString(),
  acceptedByUserId,
  lastSendError: invitation.lastSendError,
  sendAttemptCount: invitation.sendAttemptCount,
  status: "accepted",
  updatedAt: new Date().toISOString()
});

export const revokeWorkspaceInvitation = (invitation: WorkspaceInvitation): WorkspaceInvitation => ({
  ...invitation,
  acceptToken: null,
  lastSendError: invitation.lastSendError,
  sendAttemptCount: invitation.sendAttemptCount,
  status: "revoked",
  updatedAt: new Date().toISOString()
});

export const isWorkspaceInvitationExpired = (invitation: WorkspaceInvitation, now = new Date()): boolean => {
  return new Date(invitation.expiresAt).getTime() <= now.getTime();
};
