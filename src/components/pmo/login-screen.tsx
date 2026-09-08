"use client";

import * as React from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { toast } from "sonner";
import { useTMStore, type ViewKey } from "@/lib/pmo-store";
import {
  ShieldCheck,
  LogIn,
  User,
  KeyRound,
  Eye,
  EyeOff,
} from "lucide-react";

const ROLE_VIEW_MAP: Record<string, ViewKey> = {
  SUPER_ADMIN: "admin",
  MANAGER: "overview",
  SUPERVISOR: "overview",
  SPECIALIST: "mytasks",
};

export function LoginScreen() {
  const setMember = useTMStore((s) => s.setMember);
  const setAuthLoading = useTMStore((s) => s.setAuthLoading);
  const setView = useTMStore((s) => s.setView);
  const [handle, setHandle] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  async function login(e?: React.FormEvent) {
    e?.preventDefault();
    if (!handle.trim() || !password.trim()) {
      toast.error("هندل و رمز عبور را وارد کنید.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          handle: handle.trim().startsWith("@") ? handle.trim() : `@${handle.trim()}`,
          password: password.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        toast.error(data.error ?? "ورود ناموفق بود.");
        return;
      }
      const m = data.member;
      setMember(m);
      setView(ROLE_VIEW_MAP[m.role] ?? "overview");
      setAuthLoading(false);
      toast.success(`خوش آمدید، ${m.name}!`);
    } catch {
      toast.error("خطا در ارتباط با سرور.");
    } finally {
      setBusy(false);
    }
  }

  function quickLogin(h: string, p: string) {
    setHandle(h);
    setPassword(p);
    setTimeout(() => login(), 50);
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-primary/10 via-background to-background">
      <div className="w-full max-w-md">
        {/* Brand */}
        <div className="text-center mb-6">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground text-2xl font-bold mb-3 shadow-lg">
            پ
          </div>
          <h1 className="text-xl font-bold">سیستم مدیریت تسک</h1>
          <p className="text-sm text-muted-foreground mt-1">
            ورود به سامانه مدیریت تسک‌های سازمانی
          </p>
        </div>

        <Card className="shadow-xl">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <ShieldCheck className="h-5 w-5 text-primary" />
              ورود به حساب
            </CardTitle>
            <CardDescription>
              برای دسترسی به تسک‌ها، هندل و رمز عبور خود را وارد کنید.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={login} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="handle" className="flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5" />
                  هندل کاربری
                </Label>
                <Input
                  id="handle"
                  value={handle}
                  onChange={(e) => setHandle(e.target.value)}
                  placeholder="@admin"
                  dir="ltr"
                  className="text-left"
                  autoComplete="username"
                  autoFocus
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password" className="flex items-center gap-1.5">
                  <KeyRound className="h-3.5 w-3.5" />
                  رمز عبور
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••"
                    dir="ltr"
                    className="text-left pl-9"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPwd ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <Button type="submit" className="w-full" disabled={busy}>
                <LogIn className="h-4 w-4" />
                {busy ? "در حال ورود..." : "ورود"}
              </Button>
            </form>
            <div className="my-4 flex items-center gap-3">
              <div className="h-px flex-1 bg-border" />
              <span className="text-xs text-muted-foreground">Clerk</span>
              <div className="h-px flex-1 bg-border" />
            </div>
            <div className="space-y-2">
              <Button asChild variant="outline" className="w-full">
                <Link href="/sign-in?redirect_url=/console">ورود با Clerk</Link>
              </Button>
              <Button asChild variant="ghost" className="w-full">
                <Link href="/signup">ساخت شرکت</Link>
              </Button>
            </div>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              حساب شرکت ندارید؟{" "}
              <Link href="/signup" className="font-semibold text-primary hover:underline">
                ثبت شرکت
              </Link>
            </div>

          </CardContent>
        </Card>
      </div>
    </div>
  );
}
