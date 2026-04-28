import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import type { NextRequest } from "next/server";

import { authOptions } from "@/auth";
import { getInternalAuthToken, getWebApiBaseUrl } from "@/lib/env";
import { buildApiInternalAuthHeaders } from "@/lib/internal-auth-headers";

type BffRouteContext = {
  params: Promise<{
    path?: string[];
  }>;
};

const apiBaseUrl = getWebApiBaseUrl();
const internalToken = getInternalAuthToken();
const apiV1Path = "/api/v1";

const buildApiV1Url = (path: string): string => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  const base = apiBaseUrl.endsWith("/") ? apiBaseUrl.slice(0, -1) : apiBaseUrl;

  if (base.endsWith(apiV1Path)) {
    return `${base}${normalizedPath}`;
  }

  return `${base}${apiV1Path}${normalizedPath}`;
};

const isBodyAllowed = (method: string): boolean => {
  return method !== "GET" && method !== "HEAD";
};

const proxyRequest = async (request: NextRequest, pathSegments: string[]): Promise<Response> => {
  const session = await getServerSession(authOptions);

  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const headers = new Headers(request.headers);
  headers.delete("cookie");
  headers.delete("host");
  headers.delete("content-length");
  const internalHeaders = buildApiInternalAuthHeaders(
    {
      provider: session.user.provider,
      providerUserId: session.user.providerUserId,
      userEmail: session.user.email ?? "",
      userId: session.user.id,
      userName: session.user.name ?? "Unknown user"
    },
    internalToken
  );

  Object.entries(internalHeaders).forEach(([key, value]) => {
    headers.set(key, value);
  });

  const body = isBodyAllowed(request.method) ? await request.arrayBuffer() : null;
  const path = pathSegments.join("/");
  const upstreamUrl = buildApiV1Url(path);
  
  const upstream = await fetch(`${upstreamUrl}${request.nextUrl.search}`, {
    ...(body ? { body } : {}),
    headers,
    cache: "no-store",
    method: request.method,
    redirect: "manual"
  });

  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.delete("content-encoding");
  responseHeaders.delete("transfer-encoding");

  return new NextResponse(upstream.body, {
    headers: responseHeaders,
    status: upstream.status
  });
};

export async function GET(request: NextRequest, context: BffRouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyRequest(request, path ?? []);
}

export async function POST(request: NextRequest, context: BffRouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyRequest(request, path ?? []);
}

export async function PATCH(request: NextRequest, context: BffRouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyRequest(request, path ?? []);
}

export async function PUT(request: NextRequest, context: BffRouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyRequest(request, path ?? []);
}

export async function DELETE(request: NextRequest, context: BffRouteContext): Promise<Response> {
  const { path } = await context.params;
  return proxyRequest(request, path ?? []);
}
