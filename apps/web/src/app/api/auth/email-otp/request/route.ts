import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { Resend } from "resend";

import { createInternalVerificationToken } from "@/lib/auth-adapter";
import { isEmailAuthConfigured } from "@/lib/env";

type RateLimitEntry = {
  count: number;
  windowStartedAt: number;
};

const WINDOW_MS = 10 * 60 * 1000;
const MAX_REQUESTS_PER_WINDOW = 5;
const RESEND_COOLDOWN_MS = 30 * 1000;
const emailRequestTracker = new Map<string, RateLimitEntry>();
const lastIssuedAtByEmail = new Map<string, number>();

const responder = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const readClientIp = (request: NextRequest): string => {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() ?? "unknown";
  }
  return request.headers.get("x-real-ip") ?? "unknown";
};

const isEmailFormat = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const isRateLimited = (key: string): boolean => {
  const now = Date.now();
  const current = emailRequestTracker.get(key);

  if (!current || now - current.windowStartedAt > WINDOW_MS) {
    emailRequestTracker.set(key, { count: 1, windowStartedAt: now });
    return false;
  }

  if (current.count >= MAX_REQUESTS_PER_WINDOW) {
    return true;
  }

  current.count += 1;
  return false;
};

const isInCooldown = (email: string): boolean => {
  const lastIssued = lastIssuedAtByEmail.get(email);
  if (!lastIssued) {
    return false;
  }
  return Date.now() - lastIssued < RESEND_COOLDOWN_MS;
};

const genericResponse = (): Response =>
  NextResponse.json(
    {
      message: "입력한 이메일로 인증 안내를 보냈어요. 메일함을 확인해 주세요."
    },
    { status: 200 }
  );

export async function POST(request: NextRequest): Promise<Response> {
  if (!isEmailAuthConfigured() || !responder) {
    return genericResponse();
  }

  let email = "";
  try {
    const body = (await request.json()) as { email?: string };
    email = normalizeEmail(body.email ?? "");
  } catch {
    return genericResponse();
  }

  const ip = readClientIp(request);
  const limiterKey = `${ip}:${email || "unknown"}`;

  if (!email || !isEmailFormat(email) || isRateLimited(limiterKey) || isInCooldown(email)) {
    return genericResponse();
  }

  const code = String(Math.floor(Math.random() * 1_000_000)).padStart(6, "0");
  const expires = new Date(Date.now() + 10 * 60 * 1000);

  const tokenResult = await createInternalVerificationToken({
    expires: expires.toISOString(),
    identifier: `otp:${email}`,
    token: code
  });

  if (!tokenResult) {
    return genericResponse();
  }

  try {
    await responder.emails.send({
      from: process.env.EMAIL_FROM ?? "noreply@wevlo.io",
      html: `
        <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
          <p>Wevlo 인증 코드입니다.</p>
          <p style="font-size: 28px; letter-spacing: 4px; font-weight: 700;">${code}</p>
          <p>코드는 10분 동안 유효합니다.</p>
          <p style="font-size: 12px; color: #6b7280;">요청하지 않았다면 이 메일을 무시해 주세요.</p>
        </div>
      `,
      subject: "Wevlo 인증 코드",
      to: email
    });
  } catch (error) {
    console.error("Failed to send OTP email", error);
  }

  lastIssuedAtByEmail.set(email, Date.now());
  return genericResponse();
}
