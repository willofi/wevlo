"use client";

import React from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { getProviders, signIn } from "next-auth/react";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@wevlo/ui-web";
import { Logo } from "@/components/landing/logo";
import { sanitizeReturnPath } from "@wevlo/auth";

export default function LoginPage() {
  const [email, setEmail] = React.useState("");
  const [emailEnabled, setEmailEnabled] = React.useState(false);
  const [demoEnabled, setDemoEnabled] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [otpCode, setOtpCode] = React.useState("");
  const [otpVisible, setOtpVisible] = React.useState(false);
  const [isOtpSubmitting, setIsOtpSubmitting] = React.useState(false);
  const [formMessage, setFormMessage] = React.useState<string | null>(null);
  const searchParams = useSearchParams();
  const callbackUrl = React.useMemo(
    () => sanitizeReturnPath(searchParams.get("next")),
    [searchParams]
  );

  React.useEffect(() => {
    void getProviders().then((providers) => {
      setEmailEnabled(Boolean(providers?.email));
      setDemoEnabled(Boolean(providers?.credentials));
    });
  }, []);

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      setIsSubmitting(true);
      setFormMessage(null);
      try {
        const normalizedEmail = email.trim().toLowerCase();
        if (!normalizedEmail) {
          setFormMessage("이메일을 입력해 주세요.");
          return;
        }
        await signIn("email", { email: normalizedEmail, callbackUrl });
        await fetch("/api/auth/email-otp/request", {
          body: JSON.stringify({ email: normalizedEmail }),
          headers: { "content-type": "application/json" },
          method: "POST"
        });
        setOtpVisible(true);
        setFormMessage("입력한 이메일로 인증 안내를 보냈어요. 메일함을 확인해 주세요.");
      } finally {
        setIsSubmitting(false);
      }
    })();
  };

  const handleOtpLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void (async () => {
      setIsOtpSubmitting(true);
      setFormMessage(null);
      try {
        const normalizedEmail = email.trim().toLowerCase();
        const code = otpCode.trim();
        if (!normalizedEmail || !/^\d{6}$/.test(code)) {
          setFormMessage("6자리 인증 코드를 입력해 주세요.");
          return;
        }

        const result = await signIn("email-otp", {
          callbackUrl,
          code,
          email: normalizedEmail,
          redirect: false
        });

        if (!result || result.error) {
          setFormMessage("인증 코드를 확인해 주세요.");
          return;
        }

        window.location.assign(result.url ?? callbackUrl);
      } finally {
        setIsOtpSubmitting(false);
      }
    })();
  };

  const handleDemoLogin = (userId: string) => {
    void signIn("credentials", { userId, callbackUrl });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(40%_40%_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_100%)]" />
      
      <Card className="w-full max-w-md border-border/40 bg-card/50 backdrop-blur-xl shadow-2xl">
        <CardHeader className="flex flex-col items-center space-y-4 pb-8">
          <Logo size={40} className="mb-2" />
          <div className="text-center space-y-1">
            <CardTitle className="text-2xl font-bold tracking-tight">Welcome back</CardTitle>
            <CardDescription>Enter your credentials to access your workspace</CardDescription>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <Button 
            variant="outline" 
            className="w-full h-12 rounded-xl border-border/60 bg-background/50 hover:bg-secondary/80 transition-all flex items-center justify-center gap-3"
            onClick={() => void signIn("google", { callbackUrl })}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24">
              <path
                d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                fill="#4285F4"
              />
              <path
                d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                fill="#34A853"
              />
              <path
                d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"
                fill="#FBBC05"
              />
              <path
                d="M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                fill="#EA4335"
              />
            </svg>
            Continue with Google
          </Button>

          {emailEnabled ? (
            <>
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <span className="w-full border-t border-border/40" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-card px-2 text-muted-foreground">Or sign in with email</span>
                </div>
              </div>

              <form onSubmit={handleEmailLogin} className="space-y-4">
                <Input
                  type="email"
                  placeholder="name@example.com"
                  className="h-11 rounded-xl bg-background/50 border-border/60 focus:ring-primary/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
                <Button type="submit" className="w-full h-11 rounded-xl font-semibold">
                  {isSubmitting ? "Sending..." : "Continue with Email"}
                </Button>
              </form>
              {otpVisible ? (
                <form onSubmit={handleOtpLogin} className="space-y-3">
                  <Input
                    type="text"
                    placeholder="6-digit code"
                    className="h-11 rounded-xl bg-background/50 border-border/60 tracking-[0.2em] text-center"
                    value={otpCode}
                    onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    required
                  />
                  <Button type="submit" variant="secondary" className="w-full h-11 rounded-xl font-semibold">
                    {isOtpSubmitting ? "Verifying..." : "Sign in with Code"}
                  </Button>
                </form>
              ) : null}
              {formMessage ? (
                <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                  {formMessage}
                </div>
              ) : null}
            </>
          ) : (
            <div className="rounded-xl border border-border/50 bg-background/50 p-3 text-sm text-muted-foreground">
              이메일 로그인은 아직 설정되지 않았어요. 현재는 Google 또는 Demo 로그인을 사용해 주세요.
            </div>
          )}

          {demoEnabled ? (
            <div className="pt-4 space-y-3">
            <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">Demo Access</div>
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" size="sm" className="rounded-lg h-10" onClick={() => handleDemoLogin("user_demo_owner")}>
                Project Lead
              </Button>
              <Button variant="secondary" size="sm" className="rounded-lg h-10" onClick={() => handleDemoLogin("user-ava")}>
                Developer
              </Button>
            </div>
            </div>
          ) : null}
        </CardContent>
        <div className="px-8 pb-8 text-center text-sm text-muted-foreground">
          No account yet?{" "}
          <Link href="/signup" className="text-primary hover:underline font-medium">
            Continue here
          </Link>
        </div>
      </Card>
    </div>
  );
}
