"use client";

import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/jalali";
import { statusByKey } from "@/lib/constants";

type TaskOption = { id: string; code: string; title: string; status?: string; assigneeName?: string; groupName?: string | null };

export function TaskSearchSelect({ tasks, value, onChange, placeholder = "جست‌وجوی تسک...", disabled = false }: {
  tasks: TaskOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const selected = tasks.find((task) => task.id === value);
  return <Popover open={open} onOpenChange={setOpen}>
    <PopoverTrigger asChild><Button type="button" variant="outline" role="combobox" disabled={disabled} className="w-full justify-between bg-background font-normal">
      <span className="truncate">{selected ? `${selected.code} — ${selected.title}` : placeholder}</span><ChevronsUpDown className="h-4 w-4 shrink-0 opacity-50" />
    </Button></PopoverTrigger>
    <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0" align="start">
      <Command><CommandInput placeholder="کد، عنوان، مسئول یا واحد..." /><CommandList><CommandEmpty>تسکی پیدا نشد.</CommandEmpty><CommandGroup>
        {tasks.map((task) => <CommandItem key={task.id} value={`${task.code} ${toPersianDigits(task.code)} ${task.code.replace(/^TSK-/i, "")} ${toPersianDigits(task.code.replace(/^TSK-/i, ""))} ${task.title} ${task.assigneeName ?? ""} ${task.groupName ?? ""}`} onSelect={() => { onChange(task.id); setOpen(false); }}>
          <Check className={cn("ml-2 h-4 w-4", value === task.id ? "opacity-100" : "opacity-0")} /><div className="min-w-0"><div className="truncate text-sm">{task.code} — {task.title}</div>{(task.assigneeName || task.groupName || task.status) && <div className="truncate text-[11px] text-muted-foreground">{task.assigneeName}{task.groupName ? ` · ${task.groupName}` : ""}{task.status ? ` · ${statusByKey(task.status)?.label ?? task.status}` : ""}</div>}</div>
        </CommandItem>)}
      </CommandGroup></CommandList></Command>
    </PopoverContent>
  </Popover>;
}
