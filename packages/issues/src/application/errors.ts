import type { IssueState } from "@wevlo/contracts";

import type { IssueMutator } from "../domain/issue";

export class IssueAlreadyExistsError extends Error {
  constructor(projectId: string, issueKey: string) {
    super(`Issue already exists: ${projectId}/${issueKey}`);
  }
}

export class IssueNotFoundError extends Error {
  constructor(projectId: string, issueKey: string) {
    super(`Issue not found: ${projectId}/${issueKey}`);
  }
}

export class IssueMutationNotAllowedError extends Error {
  constructor(field: string, actor: IssueMutator) {
    super(`Issue field ${field} cannot be mutated by ${actor}`);
  }
}

export class IssueTransitionNotAllowedError extends Error {
  constructor(currentState: IssueState, nextState: IssueState) {
    super(`Invalid transition from ${currentState} to ${nextState}`);
  }
}

export class IssueTriageStatusError extends Error {
  constructor(issueKey: string) {
    super(`Issue must be pending triage: ${issueKey}`);
  }
}
