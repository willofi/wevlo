const trimAsciiBoundary = (value: string, separator: string): string => {
  const pattern = new RegExp(`^${separator}+|${separator}+$`, "g");
  return value.replace(pattern, "");
};

const normalizeAsciiSegments = (value: string, separator: "-" | ""): string => {
  const ascii = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  const collapsed = separator.length > 0
    ? ascii.replace(/[^a-z0-9]+/g, separator).replace(/-+/g, separator)
    : ascii.replace(/[^a-z0-9]+/g, "");

  return separator.length > 0 ? trimAsciiBoundary(collapsed, separator) : collapsed;
};

const normalizeProjectToken = (value: string): string => {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "");
};

const deriveProjectKeyBase = (value: string): string => {
  const segments = value
    .trim()
    .split(/[^A-Za-z0-9]+/)
    .map((segment) => normalizeProjectToken(segment))
    .filter((segment) => segment.length > 0);

  if (segments.length === 0) {
    return "PRJ";
  }

  if (segments.length === 1) {
    const [singleSegment] = segments;
    return singleSegment ? singleSegment.slice(0, 4) || "PRJ" : "PRJ";
  }

  const initials = segments.map((segment) => segment[0]).join("").slice(0, 4);
  return initials.length >= 2 ? initials : segments.join("").slice(0, 4) || "PRJ";
};

export const normalizeWorkspaceSlugClient = (value: string): string => {
  const normalized = normalizeAsciiSegments(value.trim(), "-");
  return normalized.length > 0 ? normalized : "workspace";
};

export const normalizeProjectKeyClient = (value: string): string => {
  const normalized = normalizeProjectToken(value.trim());
  return normalized.length > 0 ? normalized : "PRJ";
};

export const buildWorkspaceSlugCandidatesClient = (seed: string, maxAttempts = 8): string[] => {
  const base = normalizeWorkspaceSlugClient(seed);
  return Array.from({ length: Math.max(1, maxAttempts) }, (_, index) => (index === 0 ? base : `${base}-${index + 1}`));
};

export const buildProjectKeyCandidatesClient = (seed: string, maxAttempts = 8): string[] => {
  const base = deriveProjectKeyBase(seed);
  return Array.from({ length: Math.max(1, maxAttempts) }, (_, index) => (index === 0 ? base : `${base}${index + 1}`));
};
