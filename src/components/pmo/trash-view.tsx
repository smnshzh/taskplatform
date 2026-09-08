"use client";

import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  statusByKey,
  priorityByKey,
  sourceByKey,
} from "@/lib/constants";
import type { SerializedTask } from "@/lib/serialize";
import {
  toPersianDigits,
  formatJalaliDate,
} from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Trash2, RotateCcw, AlertTriangle, Inbox } from "lucide-react";

export function TrashView() {
  const queryClient = useQueryClient();
  const [restoring, setRestoring] = React.useState<string | null>(null);
  const [showPermDelete, setShowPermDelete] = React.useState<string | null>(null);
  const [permDeleting, setPermDeleting] = React.useState(false);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["tasks", "trash"],
    queryFn: async () => {
      const r = await fetch("/api/tasks?trash=1&limit=50");
      if (!r.ok) throw new Error();
      return (await r.json()) as { tasks: SerializedTask[]; pagination: { total: number } };
    },
  });

  const tasks = data?.tasks ?? [];
  const total = data?.pagination?.total ?? 0;

  async function handleRestore(id: string) {
    setRestoring(id);
    try {
      const res = await fetch(`/api/tasks/${id}/restore`, { method: "PATCH" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "خطا در بازیابی");
        return;
      }
      toast.success("تسک بازیابی شد.");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      refetch();
    } catch {
      toast.error("خطا در بازیابی.");
    } finally {
      setRestoring(null);
    }
  }

  async function handlePermanentDelete() {
    if (!showPermDelete) return;
    setPermDeleting(true);
    try {
      const res = await fetch(`/api/tasks/${showPermDelete}/permanent-delete`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error ?? "خطا در حذف دائم");
        return;
      }
      toast.success("تسک به‌صورت دائم حذف شد.");
      setShowPermDelete(null);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      refetch();
    } catch {
      toast.error("خطا در حذف دائم.");
    } finally {
      setPermDeleting(false);
    }
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header info */}
      <Card className="p-4 border-amber-200 bg-amber-50 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-amber-100 dark:bg-amber-950/60 flex items-center justify-center">
            <Trash2 className="h-5 w-5 text-amber-600 dark:text-amber-400" />
          </div>
          <div>
            <h3 className="font-semibold text-amber-800 dark:text-amber-200">
              سطل زباله
            </h3>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              {toPersianDigits(String(total))} تسک حذف‌شده — می‌توانید آنها را بازیابی یا به‌صورت دائم حذف کنید.
            </p>
          </div>
        </div>
      </Card>

      {tasks.length === 0 ? (
        <Card className="p-12 text-center">
          <Inbox className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-sm text-muted-foreground">سطل زباله خالی است.</p>
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <Table dir="rtl">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[100px]">کد</TableHead>
                <TableHead>عنوان</TableHead>
                <TableHead className="w-[110px]">مسئول</TableHead>
                <TableHead className="w-[90px]">وضعیت</TableHead>
                <TableHead className="w-[90px]">اولویت</TableHead>
                <TableHead className="w-[100px]">تاریخ حذف</TableHead>
                <TableHead className="w-[160px] text-left">عملیات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => {
                const st = statusByKey(task.status);
                const pr = priorityByKey(task.priority);
                return (
                  <TableRow key={task.id} className="opacity-75">
                    <TableCell className="font-mono text-xs">{task.code}</TableCell>
                    <TableCell className="font-medium max-w-[220px] truncate">
                      {task.title}
                    </TableCell>
                    <TableCell className="text-xs">{task.assigneeName || "—"}</TableCell>
                    <TableCell>
                      {st && (
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", st.color)}
                        >
                          {st.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {pr && (
                        <Badge
                          variant="outline"
                          className={cn("text-[10px]", pr.color)}
                        >
                          {pr.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {task.updatedAt
                        ? formatJalaliDate(new Date(task.updatedAt))
                        : "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 gap-1 text-xs"
                          disabled={restoring === task.id}
                          onClick={() => handleRestore(task.id)}
                        >
                          <RotateCcw className="h-3 w-3" />
                          {restoring === task.id ? "..." : "بازیابی"}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                          onClick={() => setShowPermDelete(task.id)}
                        >
                          <AlertTriangle className="h-3 w-3" />
                          حذف دائم
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Permanent delete confirmation */}
      <AlertDialog open={!!showPermDelete} onOpenChange={(v) => !v && setShowPermDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-rose-500" />
              حذف دائم تسک
            </AlertDialogTitle>
            <AlertDialogDescription>
              این عمل قابل بازگشت نیست! تسک و تمام لاگ‌های مرتبط برای همیشه از پایگاه داده حذف خواهند شد. آیا مطمئن هستید؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={permDeleting}>انصراف</AlertDialogCancel>
            <AlertDialogAction
              className="bg-rose-600 hover:bg-rose-700"
              onClick={handlePermanentDelete}
              disabled={permDeleting}
            >
              {permDeleting ? "در حال حذف..." : "حذف دائم"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
