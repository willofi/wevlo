import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

import { getInternalAuthToken, getWebApiBaseUrl } from "@/lib/env";

const apiBaseUrl = getWebApiBaseUrl();
const internalToken = getInternalAuthToken();

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

export async function GET(request: NextRequest): Promise<Response> {
  const email = request.nextUrl.searchParams.get("email");

  if (!email) {
    return NextResponse.json({ exists: false }, { status: 400 });
  }

  const normalized = normalizeEmail(email);

  if (!normalized) {
    return NextResponse.json({ exists: false }, { status: 400 });
  }

  const upstream = await fetch(
    `${apiBaseUrl}/internal/auth/users/by-email/${encodeURIComponent(normalized)}`,
    {
      cache: "no-store",
      headers: {
        "x-wevlo-internal-auth-token": internalToken
      },
      method: "GET"
    }
  );

  if (upstream.status === 404) {
    return NextResponse.json({ exists: false }, { status: 200 });
  }

  if (!upstream.ok) {
    return NextResponse.json({ exists: false }, { status: upstream.status });
  }

  return NextResponse.json({ exists: true }, { status: 200 });
}
