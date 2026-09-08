"use client";

import * as React from "react";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { toJalali, toGregorian, toPersianDigits, JALALI_MONTHS } from "@/lib/jalali";
import { cn } from "@/lib/utils";
import { ChevronRight, ChevronLeft, CalendarIcon } from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

/** Number of days in each Jalali month */
function jalaliMonthDays(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  // Esfand: 29 in leap years, 30 otherwise
  return isJalaliLeap(jy) ? 30 : 29;
}

function isJalaliLeap(jy: number): boolean {
  const breaks = [
    -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181,
    1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178,
  ];
  let bl = breaks.length;
  let jp = breaks[0];
  let jump = 0;
  for (let i = 1; i < bl; i++) {
    const jm = breaks[i];
    jump = jm - jp;
    if (jy < jm) {
      let n = jy - jp;
      if (jump - n < n) n = jump - n;
      if ((jump % 33) !== 0 && (jump % 33) !== 0) {
        if ((n % 33) !== 0 && (jump - n) % 33 !== 0) return false;
        else return true;
      } else return false;
    }
    jp = jm;
  }
  return false;
}

/** Day-of-week for a Jalali date (0=Saturday, 6=Friday) */
function jalaliDayOfWeek(jy: number, jm: number, jd: number): number {
  const [gy, gm, gd] = toGregorian(jy, jm, jd);
  const d = new Date(gy, gm - 1, gd);
  // Convert: JS 0=Sunday → our 0=Saturday
  return (d.getDay() + 1) % 7;
}

/** Gregorian "YYYY-MM-DD" → [jy, jm, jd] or null */
function gregorianToJalali(gregorian: string): [number, number, number] | null {
  if (!gregorian) return null;
  const d = new Date(gregorian);
  if (isNaN(d.getTime())) return null;
  return toJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/** [jy, jm, jd] → Gregorian "YYYY-MM-DD" */
function jalaliToGregorianStr(jy: number, jm: number, jd: number): string {
  const [gy, gm, gd] = toGregorian(jy, jm, jd);
  return `${gy}-${String(gm).padStart(2, "0")}-${String(gd).padStart(2, "0")}`;
}

const WEEK_HEADERS = ["ش", "ی", "د", "س", "چ", "پ", "ج"];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

interface JalaliDatePickerProps {
  /** Gregorian ISO date string, e.g. "2025-01-15" or "2025-01-15T10:30:00Z" */
  value: string;
  /** Called with Gregorian ISO "YYYY-MM-DD" when user picks a date */
  onChange: (gregorianDate: string) => void;
  /** Placeholder text */
  placeholder?: string;
  /** Disabled state */
  disabled?: boolean;
  /** Additional class for the container */
  className?: string;
  /** Compact trigger size */
  size?: "sm" | "default";
}

export function JalaliDatePicker({
  value,
  onChange,
  placeholder = "انتخاب تاریخ",
  disabled = false,
  className,
  size = "default",
}: JalaliDatePickerProps) {
  const [open, setOpen] = React.useState(false);

  // Parse incoming Gregorian value to Jalali
  const initial = React.useMemo(() => gregorianToJalali(value), [value]);
  const now = React.useMemo(() => {
    const t = new Date();
    // Approximate Tehran time for "today"
    const tehran = new Date(t.getTime() + (3.5 * 60 + t.getTimezoneOffset()) * 60000);
    return toJalali(tehran.getFullYear(), tehran.getMonth() + 1, tehran.getDate());
  }, []);

  const [viewYear, setViewYear] = React.useState(initial ? initial[0] : now[0]);
  const [viewMonth, setViewMonth] = React.useState(initial ? initial[1] : now[1]);
  const [selected, setSelected] = React.useState<[number, number, number] | null>(initial);

  // Sync when value changes from outside
  React.useEffect(() => {
    const j = gregorianToJalali(value);
    queueMicrotask(() => {
      setSelected(j);
      if (j) {
        setViewYear(j[0]);
        setViewMonth(j[1]);
      }
    });
  }, [value]);

  // Build calendar grid
  const daysInMonth = jalaliMonthDays(viewYear, viewMonth);
  const firstDow = jalaliDayOfWeek(viewYear, viewMonth, 1); // 0=Sat

  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  // Display text
  const displayText = selected
    ? `${toPersianDigits(selected[2])} ${JALALI_MONTHS[selected[1] - 1]} ${toPersianDigits(selected[0])}`
    : "";

  function selectDay(day: number) {
    const s: [number, number, number] = [viewYear, viewMonth, day];
    setSelected(s);
    onChange(jalaliToGregorianStr(s[0], s[1], s[2]));
    setOpen(false);
  }

  function prevMonth() {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  }

  function nextMonth() {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  }

  function goToday() {
    setViewYear(now[0]);
    setViewMonth(now[1]);
  }

  const isToday = (day: number) =>
    day === now[2] && viewMonth === now[1] && viewYear === now[0];

  const isSelected = (day: number) =>
    selected !== null &&
    day === selected[2] &&
    viewMonth === selected[1] &&
    viewYear === selected[0];

  // Friday index = 6
  const isFriday = (day: number) =>
    jalaliDayOfWeek(viewYear, viewMonth, day) === 6;

  return (
    <div className={cn("relative", className)}>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            size={size}
            variant="outline"
            disabled={disabled}
            className={cn(
              "w-full justify-start text-right font-normal h-9 text-xs",
              !displayText && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="ml-2 h-4 w-4 shrink-0" />
            {displayText || placeholder}
          </Button>
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start" sideOffset={4}>
          {/* Header */}
          <div className="flex items-center justify-between px-3 py-2 border-b">
            <button
              type="button"
              onClick={prevMonth}
              className="p-1 rounded-md hover:bg-accent transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              type="button"
              onClick={goToday}
              className="text-xs font-medium px-2 py-1 rounded hover:bg-accent transition-colors"
            >
              {toPersianDigits(viewYear)} {JALALI_MONTHS[viewMonth - 1]}
            </button>

            <button
              type="button"
              onClick={nextMonth}
              className="p-1 rounded-md hover:bg-accent transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
          </div>

          {/* Week headers */}
          <div className="grid grid-cols-7 gap-0 px-2 pt-2">
            {WEEK_HEADERS.map((h) => (
              <div
                key={h}
                className="text-center text-[10px] font-medium text-muted-foreground py-1"
              >
                {h}
              </div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7 gap-0 px-2 pb-2">
            {cells.map((day, i) => {
              if (day === null) {
                return <div key={`e-${i}`} className="h-8" />;
              }
              const today = isToday(day);
              const selected_ = isSelected(day);
              const friday = isFriday(day);
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={cn(
                    "h-8 w-full flex items-center justify-center rounded-full text-xs transition-colors",
                    "hover:bg-accent hover:text-accent-foreground",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                    today && !selected_ && "ring-1 ring-primary/30 font-bold",
                    selected_ &&
                      "bg-primary text-primary-foreground hover:bg-primary/90 hover:text-primary-foreground",
                    friday && !selected_ && "text-red-500 dark:text-red-400"
                  )}
                >
                  {toPersianDigits(day)}
                </button>
              );
            })}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
