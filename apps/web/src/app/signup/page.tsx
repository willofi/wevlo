"use client";

import React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@wevlo/ui-web";
import { Logo } from "@/components/landing/logo";
import { CheckCircle2 } from "lucide-react";

export default function SignupPage() {
  const [email, setEmail] = React.useState("");

  const handleSignup = (e: React.FormEvent) => {
    e.preventDefault();
    void signIn("email", { email, callbackUrl: "/" });
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-4">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(40%_40%_at_50%_50%,rgba(255,255,255,0.02)_0%,transparent_100%)]" />
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 max-w-5xl items-center">
        <div className="hidden lg:block space-y-8 p-8">
          <Logo size={48} className="mb-8" />
          <h1 className="text-5xl font-extrabold tracking-tight">The tool for high-performing teams.</h1>
          <ul className="space-y-4">
            {[
              "Blazing fast performance",
              "Keyboard-first navigation",
              "Real-time collaboration",
              "Automated sprint cycles"
            ].map((text, i) => (
              <li key={i} className="flex items-center gap-3 text-lg text-muted-foreground">
                <CheckCircle2 className="h-5 w-5 text-primary" />
                {text}
              </li>
            ))}
          </ul>
        </div>

        <Card className="w-full max-w-md border-border/40 bg-card/50 backdrop-blur-xl shadow-2xl">
          <CardHeader className="flex flex-col items-center space-y-4 pb-8 lg:items-start">
            <Logo size={40} className="lg:hidden mb-2" />
            <div className="text-center lg:text-left space-y-1">
              <CardTitle className="text-2xl font-bold tracking-tight">Create your account</CardTitle>
              <CardDescription>Get started with Wevlo today</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <Button 
              variant="outline" 
              className="w-full h-12 rounded-xl border-border/60 bg-background/50 hover:bg-secondary/80 transition-all flex items-center justify-center gap-3"
              onClick={() => void signIn("google", { callbackUrl: "/" })}
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

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border/40" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-card px-2 text-muted-foreground">Or join with email</span>
              </div>
            </div>

            <form onSubmit={handleSignup} className="space-y-4">
              <Input
                type="email"
                placeholder="work-email@company.com"
                className="h-11 rounded-xl bg-background/50 border-border/60"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
              <Button type="submit" className="w-full h-11 rounded-xl font-semibold">
                Sign up for Free
              </Button>
            </form>

            <div className="pt-4 space-y-3 border-t border-border/40">
              <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider text-center">Or try a demo</div>
              <div className="grid grid-cols-2 gap-3">
                <Button variant="secondary" size="sm" className="rounded-lg h-10" onClick={() => void signIn("credentials", { userId: "user_demo_owner", callbackUrl: "/" })}>
                  Project Lead
                </Button>
                <Button variant="secondary" size="sm" className="rounded-lg h-10" onClick={() => void signIn("credentials", { userId: "user-ava", callbackUrl: "/" })}>
                  Developer
                </Button>
              </div>
            </div>
          </CardContent>
          <div className="px-8 pb-8 text-center text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link href="/login" className="text-primary hover:underline font-medium">
              Sign in
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
