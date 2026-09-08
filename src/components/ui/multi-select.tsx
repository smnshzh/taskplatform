"use client";

import * as React from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toPersianDigits } from "@/lib/jalali";

export type MultiSelectOption = {
  value: string;
  label: string;
};

export function MultiSelect({
  options,
  value,
  onValueChange,
  placeholder,
  searchPlaceholder = "جستجو...",
  className,
}: {
  options: MultiSelectOption[];
  value: string[];
  onValueChange: (value: string[]) => void;
  placeholder: string;
  searchPlaceholder?: string;
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const selected = React.useMemo(() => new Set(value), [value]);
  const filtered = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return query
      ? options.filter((option) => option.label.toLowerCase().includes(query))
      : options;
  }, [options, search]);

  function toggle(optionValue: string) {
    onValueChange(
      selected.has(optionValue)
        ? value.filter((item) => item !== optionValue)
        : [...value, optionValue]
    );
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          aria-haspopup="listbox"
          aria-expanded={open}
          className={cn("h-9 min-w-[130px] justify-between gap-2 text-xs font-normal", className)}
        >
          <span className="truncate">
            {value.length === 0
              ? placeholder
              : value.length === 1
                ? options.find((option) => option.value === value[0])?.label
                : `${toPersianDigits(value.length)} مورد انتخاب شده`}
          </span>
          <span className="flex items-center gap-1">
            {value.length > 0 && (
              <Badge variant="secondary" className="h-5 min-w-5 px-1 text-[10px]">
                {toPersianDigits(value.length)}
              </Badge>
            )}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[260px] p-0" dir="rtl">
        <div className="relative border-b p-2">
          <Search className="absolute right-4 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={searchPlaceholder}
            className="h-8 pr-8 text-xs"
          />
        </div>
        <div role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="p-4 text-center text-xs text-muted-foreground">موردی پیدا نشد.</p>
          )}
          {filtered.map((option) => {
            const checked = selected.has(option.value);
            return (
              <button
                type="button"
                role="option"
                aria-selected={checked}
                key={option.value}
                onClick={() => toggle(option.value)}
                className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-right text-xs hover:bg-accent"
              >
                <span className={cn("flex h-4 w-4 items-center justify-center rounded border", checked && "border-primary bg-primary text-primary-foreground")}>
                  {checked && <Check className="h-3 w-3" />}
                </span>
                <span className="flex-1 truncate">{option.label}</span>
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-between border-t p-2">
          <Button type="button" variant="ghost" size="sm" className="h-7 text-xs" onClick={() => onValueChange(options.map((option) => option.value))}>
            انتخاب همه
          </Button>
          <Button type="button" variant="ghost" size="sm" className="h-7 gap-1 text-xs" disabled={value.length === 0} onClick={() => onValueChange([])}>
            <X className="h-3 w-3" />
            پاک کردن
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
