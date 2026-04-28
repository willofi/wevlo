const raw = (value: string | undefined): string => (value ?? "").trim();

export const getAuthSecret = (): string => {
  const secret = raw(process.env.AUTH_SECRET) || raw(process.env.NEXTAUTH_SECRET);
  return secret || "wevlo-dev-auth-secret";
};

export const isDevAuthEnabled = (): boolean => {
  const value = raw(process.env.ALLOW_DEV_AUTH).toLowerCase();
  return value === "1" || value === "true";
};

export const isGoogleOAuthConfigured = (): boolean => {
  return Boolean(raw(process.env.AUTH_GOOGLE_ID) && raw(process.env.AUTH_GOOGLE_SECRET));
};

export const isEmailAuthConfigured = (): boolean => {
  return Boolean(raw(process.env.RESEND_API_KEY) && raw(process.env.EMAIL_FROM));
};

export const getInternalAuthToken = (): string => {
  return raw(process.env.WEVLO_INTERNAL_AUTH_TOKEN) || "wevlo-internal-dev-token";
};

export const getWebApiBaseUrl = (): string => {
  return raw(process.env.WEVLO_API_BASE_URL) || raw(process.env.NEXT_PUBLIC_API_BASE_URL) || "http://127.0.0.1:4000";
};
