"use client";

import React from "react";
import Link from "next/link";
import { signIn } from "next-auth/react";
import { Button, Input, Card, CardContent, CardHeader, CardTitle, CardDescription } from "@wevlo/ui-web";
import { Logo } from "@/components/landing/logo";

export default function LoginPage() {
  const [email, setEmail] = React.useState(\"\");

  const handleEmailLogin = (e: React.FormEvent) => {
    e.preventDefault();
    void signIn(\"email\", { email, callbackUrl: \"/\" });
  };

  const handleDemoLogin = (userId: string) => {
    void signIn(\"credentials\", { userId, callbackUrl: \"/\" });
  };

  return (
    <div className=\"flex min-h-screen items-center justify-center bg-background p-4\">
      <div className=\"absolute inset-0 -z-10 bg-[radial-gradient(40%_40%_at_50%_50%,rgba(59,130,246,0.05)_0%,transparent_100%)]\" />
      
      <Card className=\"w-full max-w-md border-border/40 bg-card/50 backdrop-blur-xl shadow-2xl\">
        <CardHeader className=\"flex flex-col items-center space-y-4 pb-8\">
          <Logo size={40} className=\"mb-2\" />
          <div className=\"text-center space-y-1\">
            <CardTitle className=\"text-2xl font-bold tracking-tight\">Welcome back</CardTitle>\
            <CardDescription>Enter your credentials to access your workspace</CardDescription>
          </div>
        </CardHeader>
        <CardContent className=\"space-y-6\">
          <Button 
            variant=\"outline\" 
            className=\"w-full h-12 rounded-xl border-border/60 bg-background/50 hover:bg-secondary/80 transition-all flex items-center justify-center gap-3\"
            onClick={() => void signIn(\"google\", { callbackUrl: \"/\" })}\
          >
            <svg className=\"h-5 w-5\" viewBox=\"0 0 24 24\">
              <path
                d=\"M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z\"
                fill=\"#4285F4\"
              />
              <path
                d=\"M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z\"
                fill=\"#34A853\"
              />
              <path
                d=\"M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z\"
                fill=\"#FBBC05\"
              />
              <path
                d=\"M12 5.38c1.62 0 3.06.56 4.21 1.66l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z\"
                fill=\"#EA4335\"
              />
            </svg>
            Continue with Google
          </Button>

          <div className=\"relative\">
            <div className=\"absolute inset-0 flex items-center\">
              <span className=\"w-full border-t border-border/40\" />
            </div>
            <div className=\"relative flex justify-center text-xs uppercase\">
              <span className=\"bg-card px-2 text-muted-foreground\">Or sign in with email</span>
            </div>
          </div>

          <form onSubmit={handleEmailLogin} className=\"space-y-4\">
            <Input
              type=\"email\"
              placeholder=\"name@example.com\"
              className=\"h-11 rounded-xl bg-background/50 border-border/60 focus:ring-primary/20\"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <Button type=\"submit\" className=\"w-full h-11 rounded-xl font-semibold\">
              Sign in with Email
            </Button>
          </form>

          <div className=\"pt-4 space-y-3\">
            <div className=\"text-xs font-medium text-muted-foreground uppercase tracking-wider text-center\">Demo Access</div>
            <div className=\"grid grid-cols-2 gap-3\">
              <Button variant=\"secondary\" size=\"sm\" className=\"rounded-lg h-10\" onClick={() => handleDemoLogin(\"demo-user-1\")}>
                Project Lead
              </Button>
              <Button variant=\"secondary\" size=\"sm\" className=\"rounded-lg h-10\" onClick={() => handleDemoLogin(\"demo-user-2\")}>
                Developer
              </Button>
            </div>
          </div>
        </CardContent>
        <div className=\"px-8 pb-8 text-center text-sm text-muted-foreground\">
          Don't have an account?{\" \"}
          <Link href=\"/signup\" className=\"text-primary hover:underline font-medium\">
            Sign up
          </Link>
        </div>
      </Card>
    </div>
  );
}
