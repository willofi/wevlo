export const apiBffPath = "/api/bff";
export const apiV1Path = "/api/v1";

export const normalizeApiPath = (path: string): string => (path.startsWith("/") ? path : `/${path}`);

export const buildBffApiPath = (path: string): string => `${apiBffPath}${normalizeApiPath(path)}`;

export const buildApiV1Url = (baseUrl: string, path: string): string => {
  const normalizedPath = normalizeApiPath(path);
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;

  if (base.endsWith(apiV1Path)) {
    return `${base}${normalizedPath}`;
  }

  return `${base}${apiV1Path}${normalizedPath}`;
};

export const stripApiV1Path = (baseUrl: string): string => {
  const base = baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
  return base.endsWith(apiV1Path) ? base.slice(0, -apiV1Path.length) : base;
};
