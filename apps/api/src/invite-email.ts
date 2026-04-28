import type { WorkspaceRole } from "@wevlo/contracts";

type SendWorkspaceInviteEmailInput = {
  expiresAt: string;
  inviteUrl: string;
  role: WorkspaceRole;
  to: string;
  workspaceName: string;
};

const getResendConfig = (): { apiKey: string; from: string } | null => {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();

  if (!apiKey || !from) {
    return null;
  }

  return { apiKey, from };
};

export const sendWorkspaceInviteEmail = async (input: SendWorkspaceInviteEmailInput): Promise<void> => {
  const config = getResendConfig();

  if (!config) {
    throw new Error("Invite email is not configured. RESEND_API_KEY and EMAIL_FROM are required.");
  }

  const payload = {
    from: config.from,
    html: `
      <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
        <p>You were invited to join <strong>${input.workspaceName}</strong> as <strong>${input.role}</strong>.</p>
        <p><a href="${input.inviteUrl}">Open invitation</a></p>
        <p style="font-size: 12px; color: #6b7280;">This link expires on ${new Date(input.expiresAt).toLocaleString()}.</p>
      </div>
    `,
    subject: `Invitation to ${input.workspaceName}`,
    to: input.to
  };

  const response = await fetch("https://api.resend.com/emails", {
    body: JSON.stringify(payload),
    headers: {
      authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json"
    },
    method: "POST"
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Invite email send failed: ${response.status} ${message}`);
  }
};
