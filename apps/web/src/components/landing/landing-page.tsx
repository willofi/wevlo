"use client";

import React from "react";
import Link from "next/link";
import { 
  ArrowRight, 
  CheckCircle2, 
  Layers, 
  Zap, 
  Shield, 
  Users, 
  BarChart3
} from "lucide-react";
import { FaGithub } from "react-icons/fa6";
import { Button } from "@wevlo/ui-web";
import { Logo } from "./logo";

export const LandingPage = () => {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4">
          <Logo />
          <nav className="hidden md:flex items-center gap-6">
            <Link href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">Features</Link>
            <Link href="#method" className="text-sm font-medium text-muted-foreground hover:text-foreground">Method</Link>
            <Link href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">Pricing</Link>
          </nav>
          <div className="flex items-center gap-4">
            <Link href="/login">
              <Button variant="ghost" size="sm">Sign In</Button>
            </Link>
            <Link href="/signup">
              <Button size="sm">Get Started</Button>
            </Link>
          </div>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero Section */}
        <section className="relative overflow-hidden pt-20 pb-32 md:pt-32 md:pb-48">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(45%_45%_at_50%_50%,rgba(255,255,255,0.03)_0%,transparent_100%)]" />
          <div className="container mx-auto px-4 text-center">
            <div className="inline-flex items-center rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-sm font-medium text-primary mb-8 animate-in fade-in slide-in-from-bottom-4 duration-1000">
              <span className="mr-2">✨</span>
              <span>Next generation issue tracking</span>
            </div>
            <h1 className="mx-auto max-w-4xl text-5xl font-extrabold tracking-tight sm:text-7xl mb-8 bg-clip-text text-transparent bg-gradient-to-b from-foreground to-foreground/50">
              Build better software, <br /> faster than ever.
            </h1>
            <p className="mx-auto max-w-2xl text-xl text-muted-foreground mb-10">
              Wevlo is the high-performance issue tracker designed for teams that move fast. 
              Streamline your workflow from idea to deployment.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="h-12 px-8 text-base">
                  Start Building for Free
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
              <Button variant="outline" size="lg" className="h-12 px-8 text-base">
                <FaGithub className="mr-2 h-4 w-4" />
                Star on GitHub
              </Button>
            </div>
          </div>
        </section>

        {/* Workflow Narrative */}
        <section id="method" className="py-24 bg-secondary/30 border-y border-border/50">
          <div className="container mx-auto px-4">
            <div className="text-center mb-16">
              <h2 className="text-3xl font-bold mb-4">A workflow that works with you</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Stop fighting your tools. Wevlo is built around the way great engineering teams actually work.
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
              <div className="flex flex-col items-center text-center p-6 rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <Zap className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Capture</h3>
                <p className="text-muted-foreground">
                  Quickly capture ideas and bugs with a keyboard-first interface. 
                  Never lose momentum again.
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center p-6 rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <Layers className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Plan</h3>
                <p className="text-muted-foreground">
                  Organize issues into cycles and projects. 
                  Visualize your roadmap with clarity and precision.
                </p>
              </div>
              
              <div className="flex flex-col items-center text-center p-6 rounded-2xl border border-border/50 bg-background/50 backdrop-blur-sm">
                <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center text-primary mb-6">
                  <CheckCircle2 className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-semibold mb-3">Execute</h3>
                <p className="text-muted-foreground">
                  Focus on what matters. Track progress with automated cycles 
                  and real-time collaboration.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Features Preview */}
        <section id="features" className="py-24">
          <div className="container mx-auto px-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
              <div>
                <h2 className="text-4xl font-bold mb-6 tracking-tight">Built for modern velocity.</h2>
                <div className="space-y-6">
                  <div className="flex gap-4">
                    <div className="mt-1 flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Shield className="h-3 w-3" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Enterprise Grade Security</h4>
                      <p className="text-muted-foreground">Role-based access control and encrypted data storage by default.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="mt-1 flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <Users className="h-3 w-3" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Team Collaboration</h4>
                      <p className="text-muted-foreground">Multiplayer editing and real-time notifications for seamless teamwork.</p>
                    </div>
                  </div>
                  <div className="flex gap-4">
                    <div className="mt-1 flex-shrink-0 h-6 w-6 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                      <BarChart3 className="h-3 w-3" />
                    </div>
                    <div>
                      <h4 className="font-semibold mb-1">Powerful Analytics</h4>
                      <p className="text-muted-foreground">Insights into team velocity, cycle progress, and bottleneck detection.</p>
                    </div>
                  </div>
                </div>
              </div>
              <div className="relative">
                <div className="aspect-video rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
                  <div className="h-full w-full bg-gradient-to-br from-secondary to-background p-8">
                     <div className="space-y-4">
                       <div className="h-4 w-1/3 rounded bg-muted animate-pulse" />
                       <div className="h-32 w-full rounded-lg border border-border/50 bg-background/50 p-4">
                         <div className="flex gap-3 mb-4">
                           <div className="h-8 w-8 rounded bg-primary/20" />
                           <div className="space-y-2 flex-1">
                             <div className="h-3 w-1/2 rounded bg-muted" />
                             <div className="h-3 w-1/4 rounded bg-muted/50" />
                           </div>
                         </div>
                         <div className="grid grid-cols-3 gap-2">
                           <div className="h-2 w-full rounded bg-muted/30" />
                           <div className="h-2 w-full rounded bg-muted/30" />
                           <div className="h-2 w-full rounded bg-muted/30" />
                         </div>
                       </div>
                     </div>
                  </div>
                </div>
                <div className="absolute -bottom-6 -right-6 h-32 w-32 bg-primary/20 rounded-full blur-3xl -z-10" />
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/40 py-12 bg-background">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-start gap-12">
            <div className="max-w-xs">
              <Logo className="mb-4" />
              <p className="text-sm text-muted-foreground">
                The issue tracker for teams that value speed and craftsmanship.
              </p>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-12 text-sm text-muted-foreground">
              <div>
                <h4 className="font-semibold mb-4 text-foreground">Product</h4>
                <ul className="space-y-2">
                  <li><Link href="#" className="hover:text-foreground">Features</Link></li>
                  <li><Link href="#" className="hover:text-foreground">Integrations</Link></li>
                  <li><Link href="#" className="hover:text-foreground">Pricing</Link></li>
                </ul>
              </div>
              <div>
                <h4 className="font-semibold mb-4 text-foreground">Company</h4>
                <ul className="space-y-2">
                  <li><Link href="#" className="hover:text-foreground">About</Link></li>
                  <li><Link href="#" className="hover:text-foreground">Blog</Link></li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
