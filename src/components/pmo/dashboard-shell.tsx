"use client";

import * as React from "react";
import { useAuth } from "@clerk/nextjs";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { UserButton } from "@clerk/nextjs";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LoginScreen } from "./login-screen";
import { ForcedPasswordChange } from "./forced-password-change";
import { ThemeToggle } from "./theme-toggle";
import { NewTaskDialog } from "./new-task-dialog";
import { OverviewView } from "./overview-view";
import { KanbanView } from "./kanban-view";
import { TaskListView } from "./task-list-view";
import { WorkflowView } from "./workflow-view";
import { SchedulerView } from "./scheduler-view";
import { ReferredView } from "./referred-view";
import { MyTasksView } from "./my-tasks-view";
import { MembersView } from "./members-view";
import { GroupsView } from "./groups-view";
import { AccessGroupsView } from "./access-groups-view";
import { AdminView } from "./admin-view";
import { BaleManagementView } from "./bale-management-view";
import { TrashView } from "./trash-view";
import { DoneTasksView } from "./done-tasks-view";
import { useTMStore, type ViewKey } from "@/lib/pmo-store";
import { ROLES, roleByKey } from "@/lib/constants";
import type { SerializedTask } from "@/lib/serialize";
import { toPersianDigits, isOverdue, formatJalaliLong } from "@/lib/jalali";
import { hasConsoleSetupCookie } from "@/lib/console-setup";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  LayoutDashboard,
  KanbanSquare,
  ListChecks,
  CalendarClock,
  FileText,
  CheckSquare,
  Users,
  Building2,
  Settings,
  Plus,
  Menu,
  X,
  LogOut,
  ChevronDown,
  Crown,
  Trash2,
  ClipboardCheck,
  GitBranch,
  MessageCircle,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Navigation definition                                              */
/* ------------------------------------------------------------------ */

type NavItem = {
  key: ViewKey;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
  roles?: string[];
  permission?: string;
};

const ALL_NAV: NavItem[] = [
  { key: "overview", label: "داشبورد", icon: LayoutDashboard, desc: "نمای کلی و شاخص‌ها", permission: "panel:overview" },
  { key: "kanban", label: "کانبان", icon: KanbanSquare, desc: "نمودار کانبان تسک‌ها", permission: "panel:kanban" },
  { key: "list", label: "لیست تسک‌ها", icon: ListChecks, desc: "جدول با فیلترهای پیشرفته", permission: "panel:task-list" },
  { key: "workflow", label: "گردش‌کار", icon: GitBranch, desc: "ساخت و مشاهده ارتباط مرحله‌ای تسک‌ها", permission: "panel:workflow" },
  { key: "scheduler", label: "زمان‌بندی", icon: CalendarClock, desc: "زمان‌بندی و قالب‌های تسک", permission: "panel:scheduler" },
  { key: "referred", label: "ارجاع نامه‌ای", icon: FileText, desc: "تسک‌های ارجاعی", permission: "panel:referrals" },
  { key: "mytasks", label: "کارهای من", icon: CheckSquare, desc: "تسک‌های شخصی من", permission: "panel:my-tasks" },
  { key: "members", label: "اعضا", icon: Users, desc: "مدیریت اعضا", permission: "panel:members" },
  { key: "groups", label: "مجموعه‌ها", icon: Building2, desc: "مدیریت مجموعه‌های سازمانی", permission: "panel:groups" },
  { key: "donetasks", label: "انجام‌شده", icon: ClipboardCheck, desc: "گزارش کارهای انجام‌شده", permission: "panel:done-tasks" },
  { key: "trash", label: "سطل زباله", icon: Trash2, desc: "تسک‌های حذف‌شده", permission: "panel:trash" },
  { key: "bale-management", label: "مدیریت پیام‌رسان بله", icon: MessageCircle, desc: "گروه‌ها، اعلان‌های خودکار و لاگ ارسال‌ها", permission: "panel:admin" },
  { key: "admin", label: "مدیریت سیستم", icon: Settings, desc: "تنظیمات و مدیریت دسترسی", permission: "panel:admin" },
];

/* ------------------------------------------------------------------ */
/*  Role badge helpers                                                 */
/* ------------------------------------------------------------------ */

const ROLE_BADGE_CLASS: Record<string, string> = {
  SUPER_ADMIN:
    "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300",
  MANAGER:
    "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300",
  SUPERVISOR:
    "bg-sky-100 text-sky-700 dark:bg-sky-950/40 dark:text-sky-300",
  SPECIALIST:
    "bg-slate-100 text-slate-700 dark:bg-slate-800/50 dark:text-slate-300",
};

const ROLE_LABEL: Record<string, string> = {
  SUPER_ADMIN: "مدیر کل",
  MANAGER: "مدیر مجموعه",
  SUPERVISOR: "سرپرست",
  SPECIALIST: "کارشناس",
};

/* ------------------------------------------------------------------ */
/*  DashboardShell                                                     */
/* ------------------------------------------------------------------ */

export function DashboardShell() {
  const member = useTMStore((s) => s.member);
  const authLoading = useTMStore((s) => s.authLoading);
  const setMember = useTMStore((s) => s.setMember);
  const setAuthLoading = useTMStore((s) => s.setAuthLoading);
  const view = useTMStore((s) => s.view);
  const setView = useTMStore((s) => s.setView);
  const { isLoaded: clerkLoaded, isSignedIn: clerkSignedIn } = useAuth();
  const [bridgingClerk, setBridgingClerk] = React.useState(false);
  const [setupStateReady, setSetupStateReady] = React.useState(false);
  const [setupRequired, setSetupRequired] = React.useState(false);

  const [newTaskOpen, setNewTaskOpen] = React.useState(false);
  const [newTaskKey, setNewTaskKey] = React.useState(0);
  const [mobileNavOpen, setMobileNavOpen] = React.useState(false);

  // Check session on mount
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch("/api/auth/me");
        if (r.ok) {
          const data = await r.json();
          if (!cancelled && data.member) {
            setMember(data.member);
            const role = data.member.role;
            if (role === "SUPER_ADMIN") setView("admin");
            else if (role === "MANAGER" || role === "SUPERVISOR") setView("overview");
            else if (role === "SPECIALIST") setView("mytasks");
            else setView("overview");
          } else if (!cancelled) {
            setMember(null);
          }
        } else if (!cancelled) {
          setMember(null);
        }
      } catch {
        if (!cancelled) setMember(null);
      } finally {
        if (!cancelled) setAuthLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }

    setSetupRequired(hasConsoleSetupCookie(document.cookie));
    setSetupStateReady(true);
  }, []);

  React.useEffect(() => {
    if (authLoading || member || bridgingClerk || !clerkLoaded || !clerkSignedIn) {
      return;
    }

    if (!setupStateReady || setupRequired) {
      return;
    }

    setBridgingClerk(true);
    window.location.replace("/api/auth/clerk/bridge?returnTo=/console");
  }, [authLoading, bridgingClerk, clerkLoaded, clerkSignedIn, member, setupRequired, setupStateReady]);

  // Fetch tasks
  const { data } = useQuery({
    queryKey: ["tasks", "all"],
    queryFn: async () => {
      const r = await fetch("/api/tasks");
      if (r.status === 401) return { tasks: [] as SerializedTask[] };
      return (await r.json()) as { tasks: SerializedTask[] };
    },
    enabled: !!member,
  });
  const tasks = data?.tasks ?? [];
  const overdueCount = tasks.filter((t) =>
    isOverdue(new Date(t.deadline), t.status)
  ).length;

  const queryClient = useQueryClient();
  function refreshAll() {
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
    queryClient.invalidateQueries({ queryKey: ["dashboard-stats"] });
    queryClient.invalidateQueries({ queryKey: ["members"] });
    queryClient.invalidateQueries({ queryKey: ["admin"] });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    queryClient.clear();
    setMember(null);
    setView("overview");
    toast.success("از حساب خارج شدید.");
  }

  /* ---- Auth gate ---- */
  if (authLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">در حال بارگذاری...</p>
        </div>
      </div>
    );
  }

  if (!member && clerkLoaded && clerkSignedIn && !setupStateReady) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">در حال بررسی حساب Clerk...</p>
        </div>
      </div>
    );
  }

  if (bridgingClerk) {
    return (
      <div className="h-screen flex items-center justify-center bg-muted/20">
        <div className="flex flex-col items-center gap-3 text-muted-foreground">
          <div className="h-10 w-10 rounded-full border-4 border-primary border-t-transparent animate-spin" />
          <p className="text-sm">در حال اتصال به Clerk...</p>
        </div>
      </div>
    );
  }

  if (!member) {
    if (clerkLoaded && clerkSignedIn && setupRequired) {
      return <ConsoleSetupScreen />;
    }
    return <LoginScreen />;
  }

  if (member.mustChangePassword) {
    return <ForcedPasswordChange />;
  }

  /* ---- Filtered nav ---- */
  const role = member.role;
  const nav = ALL_NAV.filter(
    (n) => (!n.roles || n.roles.includes(role)) && (!n.permission || member.permissions.includes(n.permission))
  );
  const currentNav: NavItem = view === "access-groups"
    ? {
        key: "access-groups" as const,
        label: "مدیریت دسترسی‌ها",
        icon: Settings,
        desc: "مدیریت گروه‌های دسترسی و مجوزهای اعضا",
      }
    : nav.find((n) => n.key === view) ?? nav[0];
  const canCreateTask = member.permissions.includes("task:create");

  /* ---- Role badge ---- */
  const roleInfo = roleByKey(role);
  const roleLabel = ROLE_LABEL[role] ?? roleInfo?.label ?? role;
  const roleBadgeClass = ROLE_BADGE_CLASS[role] ?? "bg-muted text-muted-foreground";

  return (
    <div className="h-screen flex flex-col bg-muted/20">
      {/* ======== Top bar ======== */}
      <header className="h-14 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-30">
        <div className="h-full flex items-center gap-3 px-3 sm:px-4">
          {/* Mobile toggle */}
          <button
            className="lg:hidden text-muted-foreground hover:text-foreground"
            onClick={() => setMobileNavOpen((v) => !v)}
          >
            {mobileNavOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>

          {/* Logo */}
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-sm">
              پ
            </div>
            <div className="hidden sm:block">
              <div className="text-sm font-bold leading-tight">
                مدیریت تسک
              </div>
            </div>
          </div>

          {/* Online & overdue badges */}
          <div className="hidden md:flex items-center gap-1.5 mr-2">
            <Badge variant="outline" className="gap-1 text-xs font-normal">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              آنلاین
            </Badge>
            {overdueCount > 0 && (
              <Badge className="gap-1 text-xs bg-rose-100 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300">
                {toPersianDigits(overdueCount)} عقب‌افتاده
              </Badge>
            )}
          </div>

          {/* Right section */}
          <div className="mr-auto flex items-center gap-2">
            {canCreateTask && (
              <Button
                size="sm"
                onClick={() => { setNewTaskKey((k) => k + 1); setNewTaskOpen(true); }}
                className="gap-1.5"
              >
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">تسک جدید</span>
              </Button>
            )}

            <ThemeToggle />

            {/* User dropdown */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="gap-1.5 px-2 h-9">
                  <Avatar className="h-7 w-7">
                    <AvatarFallback
                      className={cn(
                        "text-xs font-bold",
                        roleBadgeClass
                      )}
                    >
                      {member.name.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                  <span className="hidden sm:inline text-sm font-medium max-w-[120px] truncate">
                    {member.name}
                  </span>
                  <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <DropdownMenuLabel>
                  <div className="flex items-center gap-2">
                    <Avatar className="h-9 w-9">
                      <AvatarFallback
                        className={cn(
                          "text-xs font-bold",
                          roleBadgeClass
                        )}
                      >
                        {member.name.charAt(0)}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate flex items-center gap-1">
                        {member.name}
                        {role === "MANAGER" && (
                          <Crown className="h-3 w-3 text-amber-500" />
                        )}
                      </div>
                      <div
                        className="text-xs text-muted-foreground"
                        dir="ltr"
                      >
                        {member.handle}
                      </div>
                    </div>
                  </div>

                  {/* Role badge */}
                  <div className="mt-2 pt-2 border-t flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">
                      نقش:
                    </span>
                    <span
                      className={cn(
                        "inline-flex items-center gap-1 text-xs font-medium rounded-md px-2 py-0.5",
                        roleBadgeClass
                      )}
                    >
                      {role === "MANAGER" && (
                        <Crown className="h-3 w-3" />
                      )}
                      {roleLabel}
                    </span>
                  </div>

                  {/* Group name if available */}
                  {member.groupName && (
                    <div className="mt-1 flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">
                        مجموعه:
                      </span>
                      <span className="text-xs font-medium text-foreground">
                        {member.groupName}
                      </span>
                    </div>
                  )}
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {role === "SPECIALIST" && (
                  <div className="px-2 py-1.5 text-[11px] text-muted-foreground bg-muted/40">
                    شما فقط تسک‌های خودتان را می‌بینید.
                  </div>
                )}
                <DropdownMenuItem
                  onClick={logout}
                  className="text-rose-600 focus:text-rose-700"
                >
                  <LogOut className="h-4 w-4" />
                  خروج از حساب
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </header>

      {/* ======== Body (sidebar + main) ======== */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar */}
        <aside
          className={cn(
            "w-60 shrink-0 border-l bg-background flex-col z-20",
            "fixed lg:static inset-y-0 right-0 top-14 lg:top-0",
            "transition-transform lg:translate-x-0",
            mobileNavOpen
              ? "flex translate-x-0"
              : "flex translate-x-full lg:translate-x-0"
          )}
        >
          <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
            {nav.map((item) => {
              const Icon = item.icon;
              const active = view === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => {
                    setView(item.key);
                    setMobileNavOpen(false);
                  }}
                  className={cn(
                    "w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm transition-colors text-right",
                    active
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="flex-1 font-medium">{item.label}</span>
                  {item.roles && (
                    <Crown
                      className={cn(
                        "h-3 w-3",
                        active
                          ? "text-primary-foreground/70"
                          : "text-amber-500"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Sidebar footer with date */}
          <div className="p-3 border-t">
            <div className="rounded-lg bg-muted/60 p-2.5 text-[11px] text-center text-muted-foreground">
              {formatJalaliLong(new Date())}
            </div>
          </div>
        </aside>

        {/* Mobile overlay */}
        {mobileNavOpen && (
          <div
            className="fixed inset-0 top-14 bg-black/30 z-10 lg:hidden"
            onClick={() => setMobileNavOpen(false)}
          />
        )}

        {/* ======== Main content ======== */}
        {/* تغییر اصلی در این تگ انجام شد: overflow-hidden به overflow-y-auto تغییر یافت */}
        <main className="flex-1 flex flex-col overflow-y-auto">
          {/* Sub-header */}
          <div className="h-12 shrink-0 border-b bg-background px-4 flex items-center justify-between">
            <div>
              <h1 className="text-sm font-semibold flex items-center gap-2">
                {currentNav?.label}
                {currentNav?.roles && (
                  <Crown className="h-3.5 w-3.5 text-amber-500" />
                )}
              </h1>
              <p className="text-[11px] text-muted-foreground hidden sm:block">
                {currentNav?.desc}
              </p>
            </div>
            <div className="text-[11px] text-muted-foreground hidden sm:block">
              {formatJalaliLong(new Date())}
            </div>
          </div>

          {/* View area */}
          {/* تغییر اصلی در این تگ انجام شد: overflow-hidden به overflow-y-auto تغییر یافت */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4">
            {view === "overview" && <OverviewView />}
            {view === "kanban" && <KanbanView />}
            {view === "list" && <TaskListView />}
            {view === "workflow" && <WorkflowView />}
            {view === "scheduler" && member.permissions.includes("panel:scheduler") && <SchedulerView />}
            {view === "referred" && <ReferredView />}
            {view === "mytasks" && <MyTasksView />}
            {view === "members" && member.permissions.includes("panel:members") && <MembersView />}
            {view === "groups" && member.permissions.includes("panel:groups") && <GroupsView />}
            {view === "access-groups" && member.permissions.includes("access-group:manage") && <AccessGroupsView />}
            {view === "donetasks" && <DoneTasksView />}
            {view === "trash" && member.permissions.includes("panel:trash") && <TrashView />}
            {view === "bale-management" && member.permissions.includes("panel:admin") && <BaleManagementView />}
            {view === "admin" && member.permissions.includes("panel:admin") && <AdminView />}
          </div>
        </main>
      </div>

      {/* New task dialog for non-SPECIALIST */}
      {canCreateTask && (
        <NewTaskDialog
          key={newTaskKey}
          open={newTaskOpen}
          onOpenChange={setNewTaskOpen}
          onCreated={refreshAll}
        />
      )}
    </div>
  );
}

function ConsoleSetupScreen() {
  return (
    <div className="h-screen flex items-center justify-center bg-muted/20 p-4">
      <div className="w-full max-w-lg rounded-3xl border bg-background p-8 shadow-xl">
        <div className="space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            <Building2 className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">حساب شما وصل شد، اما هنوز شرکتی ندارد</h1>
            <p className="mt-2 text-sm text-muted-foreground leading-6">
              با همین حساب Clerk وارد شده‌اید. برای ادامه باید شرکت خود را بسازید تا داشبورد و داده‌های همان شرکت فعال شود.
            </p>
          </div>
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          <Button asChild className="w-full">
            <Link href="/signup">ساخت شرکت</Link>
          </Button>
          <div className="flex items-center justify-center rounded-xl border border-dashed px-4 py-3">
            <UserButton />
          </div>
        </div>

        <p className="mt-4 text-xs leading-5 text-muted-foreground">
          اگر این حساب Clerk اشتباه است، از منوی پروفایل خارج شوید و با حساب درست وارد شوید.
        </p>
      </div>
    </div>
  );
}
