"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LoaderCircle, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { GuestOnly } from "@/components/auth/guest-only";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authService } from "@/services/auth-service";
import { getApiErrorMessage } from "@/services/api-client";
import { useAuthStore } from "@/store/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const setToken = useAuthStore((state) => state.setToken);
  const setAuthenticatedContext = useAuthStore((state) => state.setAuthenticatedContext);
  const clearAuth = useAuthStore((state) => state.clearAuth);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);

    try {
      const response = await authService.login({
        email,
        password,
      });

      setToken(response.token);

      const context = await authService.getCurrentContext();
      setAuthenticatedContext(context);

      toast.success(`Welcome back, ${context.user.fullName.split(" ")[0] ?? "team"}.`);
      router.replace("/dashboard");
    } catch (error) {
      clearAuth();
      toast.error(getApiErrorMessage(error, "We could not sign you in with those credentials."));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <GuestOnly>
      <div className="flex min-h-screen items-center justify-center px-4 py-10">
        <div className="grid w-full max-w-6xl gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="glass-panel hidden rounded-[36px] p-10 lg:flex lg:flex-col lg:justify-between">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-[color:var(--tenant-primary)]/10 px-4 py-2 text-sm font-semibold text-[color:var(--tenant-primary)]">
                <ShieldCheck className="h-4 w-4" />
                Ecosys ServiceOps
              </div>
              <h1 className="display-font mt-7 max-w-xl text-5xl font-semibold leading-tight text-slate-900">
                Modern branch-aware operations for teams that keep the real world running.
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-8 text-slate-600">
                Sign in to manage work orders, materials, branches, users, and tenant settings from one calm command
                surface.
              </p>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              {[
                ["JWT auth", "Secure tenant sessions with branch-aware access control baked in."],
                ["Mobile-first", "A responsive shell that works for admins, coordinators, and technicians alike."],
                ["Future-ready", "Built to host more Ecosys modules without redesigning the whole product."],
              ].map(([title, description]) => (
                <div key={title} className="rounded-[24px] border border-white/60 bg-white/70 p-5">
                  <p className="font-semibold text-slate-900">{title}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{description}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-panel rounded-[32px] px-6 py-8 md:px-8 md:py-10">
            <div className="mx-auto max-w-md">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[color:var(--tenant-primary)]">Sign in</p>
              <h2 className="display-font mt-3 text-3xl font-semibold text-slate-900">Open your ServiceOps workspace</h2>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Use your tenant account to continue into the dashboard and branch-aware operations.
              </p>

              <form className="mt-8 space-y-5" onSubmit={handleSubmit}>
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="email">
                    Email
                  </label>
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@company.com"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-700" htmlFor="password">
                    Password
                  </label>
                  <Input
                    id="password"
                    type="password"
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                  />
                </div>

                <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? (
                    <>
                      <LoaderCircle className="h-4 w-4 animate-spin" />
                      Signing you in...
                    </>
                  ) : (
                    "Continue to dashboard"
                  )}
                </Button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </GuestOnly>
  );
}
