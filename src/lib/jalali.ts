// Jalali (Shamsi) date utilities — pure, dependency-free conversion.
// Algorithm: algorithm by Kazimierz M. Borkowski / adapted astronomical formula.

export function toJalali(gy: number, gm: number, gd: number): [number, number, number] {
  const g_d_m = [0, 31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334];
  const gy2 = gm > 2 ? gy + 1 : gy;
  let days =
    355666 +
    365 * gy +
    Math.floor((gy2 + 3) / 4) -
    Math.floor((gy2 + 99) / 100) +
    Math.floor((gy2 + 399) / 400) +
    gd +
    g_d_m[gm - 1];
  let jy = -1595 + 33 * Math.floor(days / 12053);
  days %= 12053;
  jy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    jy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let jm: number;
  let jd: number;
  if (days < 186) {
    jm = 1 + Math.floor(days / 31);
    jd = 1 + (days % 31);
  } else {
    jm = 7 + Math.floor((days - 186) / 30);
    jd = 1 + ((days - 186) % 30);
  }
  return [jy, jm, jd];
}

export function toGregorian(jy: number, jm: number, jd: number): [number, number, number] {
  let gy =
    jy <= 979 ? 621 : 1600;
  jy -= jy <= 979 ? 0 : 979;
  let days =
    365 * jy +
    Math.floor(jy / 33) * 8 +
    Math.floor(((jy % 33) + 3) / 4) +
    78 +
    jd +
    (jm < 7 ? (jm - 1) * 31 : (jm - 7) * 30 + 186);
  gy += 400 * Math.floor(days / 146097);
  days %= 146097;
  if (days > 36524) {
    gy += 100 * Math.floor(--days / 36524);
    days %= 36524;
    if (days >= 365) days++;
  }
  gy += 4 * Math.floor(days / 1461);
  days %= 1461;
  if (days > 365) {
    gy += Math.floor((days - 1) / 365);
    days = (days - 1) % 365;
  }
  let gd = days + 1;
  const sal_a = [
    0,
    31,
    (gy % 4 === 0 && gy % 100 !== 0) || gy % 400 === 0 ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31,
  ];
  let gm = 0;
  for (gm = 0; gm < 13 && gd > sal_a[gm]; gm++) gd -= sal_a[gm];
  return [gy, gm, gd === 0 ? 1 : gd];
}

const JALALI_MONTHS = [
  "فروردین",
  "اردیبهشت",
  "خرداد",
  "تیر",
  "مرداد",
  "شهریور",
  "مهر",
  "آبان",
  "آذر",
  "دی",
  "بهمن",
  "اسفند",
];

const PERSIAN_WEEKDAYS = [
  "یکشنبه",
  "دوشنبه",
  "سه‌شنبه",
  "چهارشنبه",
  "پنجشنبه",
  "جمعه",
  "شنبه",
];

const PERSIAN_WEEKDAYS_SHORT = ["یک", "دو", "سه", "چهار", "پنج", "جمعه", "شنبه"];

export function toPersianDigits(input: string | number): string {
  const fa = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"];
  return String(input).replace(/\d/g, (d) => fa[+d]);
}

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

// Format a Date to Jalali "YYYY/MM/DD"
export function formatJalaliDate(date: Date): string {
  const [jy, jm, jd] = toJalali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  return toPersianDigits(`${jy}/${String(jm).padStart(2, "0")}/${String(jd).padStart(2, "0")}`);
}

// Format with month name: "۱۵ مهر ۱۴۰۳"
export function formatJalaliLong(date: Date): string {
  const [jy, jm, jd] = toJalali(
    date.getFullYear(),
    date.getMonth() + 1,
    date.getDate()
  );
  return `${toPersianDigits(jd)} ${JALALI_MONTHS[jm - 1]} ${toPersianDigits(jy)}`;
}

// Format time "HH:MM" in Persian digits
export function formatTime(date: Date): string {
  return toPersianDigits(
    `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
  );
}

// Format "HH:MM — YYYY/MM/DD"
export function formatDateTime(date: Date): string {
  return `${formatTime(date)} — ${formatJalaliDate(date)}`;
}

export function jalaliWeekday(date: Date): string {
  return PERSIAN_WEEKDAYS[date.getDay()];
}

export function jalaliWeekdayShort(date: Date): string {
  return PERSIAN_WEEKDAYS_SHORT[date.getDay()];
}

export function jalaliMonthName(date: Date): string {
  const [, jm] = toJalali(date.getFullYear(), date.getMonth() + 1, date.getDate());
  return JALALI_MONTHS[jm - 1];
}

// "YYYY-MM-DD" key in Asia/Tehran (using local time approximated to Tehran = UTC+3:30)
export function jalaliDateKey(date: Date): string {
  // Tehran is UTC+3:30
  const tehran = new Date(date.getTime() + (3.5 * 60 + date.getTimezoneOffset()) * 60000);
  const [jy, jm, jd] = toJalali(
    tehran.getFullYear(),
    tehran.getMonth() + 1,
    tehran.getDate()
  );
  return `${jy}-${String(jm).padStart(2, "0")}-${String(jd).padStart(2, "0")}`;
}

// Get current "now" shifted to Tehran time
export function tehranNow(): Date {
  const now = new Date();
  return new Date(now.getTime() + (3.5 * 60 + now.getTimezoneOffset()) * 60000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function isOverdue(deadline: Date, status: string): boolean {
  if (status === "DONE") return false;
  return deadline.getTime() < Date.now();
}

export function isToday(deadline: Date): boolean {
  return isSameDay(deadline, new Date());
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

export { JALALI_MONTHS, PERSIAN_WEEKDAYS, PERSIAN_WEEKDAYS_SHORT };
