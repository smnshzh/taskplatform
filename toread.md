# راهنمای انتقال و ادامه پیاده‌سازی TaskManager

این فایل برای انتقال پروژه به یک پوشه یا محیط اجرایی دیگر تهیه شده است. هدف کار بعدی، تکمیل اتصال پیام‌رسان بله، یادآوری سررسیدها و گردش اعلان تأیید/رد تسک‌های ارجاعی است.

## 1. مسیر و ساختار پروژه

- مسیر فعلی برنامه: `/home/planninguser/taskmanager/taskmanager`
- فریم‌ورک: Next.js 16 با App Router
- زبان: TypeScript
- پایگاه داده: PostgreSQL
- ORM: Prisma 6
- Package manager: npm
- پورت برنامه: `8502`
- مدیریت اجرای production: PM2
- فایل PM2: `ecosystem.config.cjs`
- راهنمای اصلی توسعه: `AGENTS.md`
- ADR اعلان‌ها: `docs/adr/0001-notification-outbox.md`

پوشه‌ی بیرونی `/home/planninguser/taskmanager` نیز بخشی از یک worktree بسیار شلوغ است. هنگام انتقال، خود پوشه‌ی داخلی `taskmanager/` را به‌عنوان ریشه‌ی برنامه در نظر بگیرید؛ وجود `package.json`، `prisma/schema.prisma` و `src/` را پس از کپی بررسی کنید.

## 2. وضعیت فعلی قابلیت‌ها

موارد موجود:

- احراز هویت مبتنی بر session و cookie
- نقش‌ها و permissionها
- ایجاد، ویرایش، حذف نرم و بازیابی تسک
- تسک ارجاعی با وضعیت‌های `PENDING_APPROVAL`، `APPROVED` و `REJECTED`
- API تأیید یا رد در `src/app/api/tasks/[id]/approve/route.ts`
- رابط provider اعلان در `src/features/notifications/server/providers/notification-provider.ts`
- ADR پذیرفته‌شده برای استفاده از Database Outbox
- متغیرهای نمونه‌ی بله، تلگرام و worker در `.env.example`

مواردی که هنوز باید پیاده‌سازی یا تکمیل شوند:

1. مدل‌ها و migrationهای اعلان در Prisma
2. اتصال یک‌بارمصرف حساب کاربر به بله
3. webhook امن بله و جلوگیری از پردازش تکراری updateها
4. Bale provider برای ارسال پیام
5. Notification Outbox، dispatcher، templateها و retry
6. worker مستقل PM2
7. ساخت اعلان هنگام ایجاد/ارجاع/تأیید/رد تسک
8. یادآوری `TASK_DUE_SOON` و `TASK_OVERDUE`
9. API یا UI نمایش وضعیت اتصال بله و قطع اتصال
10. تست‌های واحد و integration

در اجرای قبلی هیچ patch مربوط به این قابلیت‌ها اعمال نشد؛ ابزار ویرایش محیط با خطای `bwrap: loopback: Failed RTM_NEWADDR: Operation not permitted` متوقف شد.

## 3. اطلاعات پایگاه داده

پروژه از PostgreSQL و Prisma استفاده می‌کند:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

رشته‌ی اتصال واقعی در فایل `.env` نگهداری می‌شود و نباید داخل Git یا این سند قرار گیرد. هنگام انتقال، فایل `.env` را جداگانه و از یک مسیر امن منتقل کنید یا مقدار زیر را در محیط مقصد تعریف کنید:

```dotenv
DATABASE_URL="postgresql://DB_USER:DB_PASSWORD@DB_HOST:5432/DB_NAME?schema=public"
```

مدل‌های فعلی مهم:

- `OrgGroup`: مجموعه‌های سازمانی
- `GroupManager`: ارتباط چندبه‌چند مدیر و مجموعه
- `Member`: کاربران، نقش، سرپرست و گروه
- `Task`: تسک، مسئول، سررسید و وضعیت تأیید
- `FollowUpLog`: تاریخچه تغییر وضعیت و تأیید
- `TaskSchedule` و `TaskTemplate`: زمان‌بندی تسک‌ها
- `AccessGroup` و `AccessGroupMember`: permissionها
- `Session`: نشست‌های احراز هویت
- `AuditLog`: رویدادهای امنیتی و مدیریتی

فیلدهای گردش تأیید در مدل `Task`:

```text
source          MANUAL | SCHEDULED | REFERRED
refererId       ارجاع‌دهنده
approvalStatus  PENDING_APPROVAL | APPROVED | REJECTED
approverId      تأییدکننده/ردکننده
approvedAt      زمان تصمیم
```

مدل‌های پیشنهادی و پذیرفته‌شده برای اضافه‌شدن:

- `NotificationChannel`
- `NotificationPreference`
- `NotificationOutbox`
- `NotificationLog`
- `AccountLinkCode`
- `ProcessedProviderUpdate`

نکات الزامی دیتابیس:

- کد خام اتصال بله ذخیره نشود؛ فقط hash آن ذخیره شود.
- روی `(provider, externalUserId)` و `(memberId, provider)` unique index باشد.
- `NotificationOutbox.idempotencyKey` یکتا باشد.
- update دریافتی بله با `(provider, updateId)` deduplicate شود.
- ایجاد/تغییر تسک و ایجاد outbox مربوط به آن در یک transaction انجام شود.
- خطای بله نباید transaction تسک را rollback کند.

## 4. راه‌اندازی دیتابیس در محیط مقصد

بعد از کپی پروژه و تنظیم `DATABASE_URL`:

```bash
npm install
npx prisma generate
npx prisma validate
npx prisma migrate deploy
```

برای محیط توسعه‌ی کاملاً جدید و بدون داده، در صورت نیاز:

```bash
npm run db:seed
```

`db:seed` را روی دیتابیس production موجود بدون بررسی محتوای `prisma/seed.ts` اجرا نکنید.

برای بررسی اتصال:

```bash
node scripts/check-db.js
```

اگر این اسکریپت در نسخه‌ی منتقل‌شده وجود نداشت، اجرای `npx prisma validate` فقط schema را بررسی می‌کند و اجرای `npx prisma migrate status` برای بررسی اتصال و وضعیت migration مناسب است.

## 5. متغیرهای محیطی موردنیاز

الگوی کامل در `.env.example` موجود است:

```dotenv
DATABASE_URL=

APP_BASE_URL=
APP_TIMEZONE=Asia/Tehran
PORT=8502

SESSION_SECRET=
SESSION_COOKIE_NAME=tm_session

TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBHOOK_SECRET=
TELEGRAM_WEBHOOK_URL=

BALE_BOT_TOKEN=
BALE_WEBHOOK_SECRET=
BALE_WEBHOOK_URL=

NOTIFICATION_WORKER_ENABLED=true
NOTIFICATION_BATCH_SIZE=50
NOTIFICATION_MAX_ATTEMPTS=5
```

مقادیر `DATABASE_URL`، `SESSION_SECRET`، `BALE_BOT_TOKEN` و `BALE_WEBHOOK_SECRET` محرمانه‌اند. آن‌ها را در چت، Git، log یا فایل‌های Markdown ثبت نکنید.

برای `APP_BASE_URL` آدرس عمومی HTTPS سامانه را قرار دهید. تمام تاریخ‌های قابل نمایش و محاسبات روزانه باید با منطقه زمانی `Asia/Tehran` سازگار باشند.

## 6. طراحی مورد انتظار اتصال بله

گردش پیشنهادی:

1. کاربر وارد سامانه می‌شود و درخواست اتصال بله می‌دهد.
2. سرور یک کد تصادفی کوتاه‌عمر و یک‌بارمصرف تولید می‌کند.
3. فقط hash کد در `AccountLinkCode` ذخیره می‌شود.
4. کاربر `/start CODE` یا `/link CODE` را برای بات بله می‌فرستد.
5. webhook با secret معتبر payload را بررسی می‌کند.
6. update تکراری با `ProcessedProviderUpdate` رد می‌شود.
7. کد معتبر مصرف و `NotificationChannel` به عضو متصل می‌شود.
8. کانال با `isVerified=true` و `isEnabled=true` فعال می‌شود.
9. پیام تأیید اتصال برای کاربر ارسال می‌شود.

مسیرهای API پیشنهادی:

```text
GET    /api/integrations/bale/link
POST   /api/integrations/bale/link
DELETE /api/integrations/bale/link
POST   /api/integrations/bale/webhook
```

الزامات امنیتی:

- کد اتصال حدود ۱۰ دقیقه اعتبار داشته باشد.
- کد یک‌بارمصرف، قابل ابطال و محدود به provider و member باشد.
- درخواست ساخت کد rate-limit شود.
- secret وبهوک پیش از پردازش payload بررسی شود.
- body کامل webhook و tokenها log نشوند.
- بات در فاز اول اجازه تغییر وضعیت یا مالکیت تسک نداشته باشد.

## 7. Outbox، یادآوری و retry

Task route نباید مستقیماً API بله را فراخوانی کند. در transaction تسک، outbox ساخته شود و worker آن را ارسال کند.

رویدادهای حداقلی این مرحله:

```text
TASK_ASSIGNED
TASK_REFERRED
TASK_REFERRAL_APPROVED
TASK_REFERRAL_REJECTED
TASK_DUE_SOON
TASK_OVERDUE
```

گیرندگان پیشنهادی:

- `TASK_ASSIGNED`: مسئول تسک
- `TASK_REFERRED`: سرپرست مسئول و مدیران مجموعه که اجازه تأیید دارند
- `TASK_REFERRAL_APPROVED/REJECTED`: مسئول و ارجاع‌دهنده
- `TASK_DUE_SOON/TASK_OVERDUE`: مسئول تسک

قواعد یادآوری:

- تسک‌های حذف‌شده یا `DONE` اعلان سررسید نگیرند.
- برای هر بازه‌ی یادآوری idempotency key پایدار تولید شود.
- worker با timezone تهران کار کند.
- پیشنهاد اولیه: یادآوری نزدیک سررسید در بازه ۲۴ ساعت و overdue روزی یک بار.
- retryهای پذیرفته‌شده در ADR: فوری، ۱ دقیقه، ۵ دقیقه، ۱۵ دقیقه و ۱ ساعت.
- خطاهای دائمی recipient/auth بدون retry بیشتر به `FAILED` بروند.
- rowهای در حال پردازش lock/claim شوند تا دو worker پیام تکراری نفرستند.

## 8. گردش تأیید تسک

رفتار فعلی:

- ایجاد تسک با `source=REFERRED` آن را در وضعیت `PENDING_APPROVAL` قرار می‌دهد.
- endpoint تأیید فقط `APPROVED` یا `REJECTED` را قبول می‌کند.
- permission لازم: `task:approve-referral`
- سرپرست فقط تسک زیردستان خود را تأیید می‌کند.
- مدیر فقط تسک مجموعه‌های تحت مدیریت خود را تأیید می‌کند.
- تصمیم در `FollowUpLog` ثبت می‌شود.

تغییر بعدی باید update تسک، ثبت `FollowUpLog` و ایجاد outboxهای نتیجه را در یک transaction واحد قرار دهد. قرارداد فعلی API و کنترل permission نباید شکسته شود.

## 9. اجرای برنامه و worker

توسعه:

```bash
npm run dev
```

بررسی کیفیت:

```bash
npm run lint
npm run typecheck
npm test
npm run build
```

production فعلی:

```bash
npm run build
pm2 start ecosystem.config.cjs
```

پس از اضافه‌شدن worker، یک process جداگانه در `ecosystem.config.cjs` تعریف شود؛ خاموش‌شدن worker نباید برنامه‌ی اصلی را متوقف کند. پیش از restart production، ابتدا migration اجرا و سپس health endpoint بررسی شود:

```bash
npx prisma migrate deploy
pm2 restart taskmanager --update-env
curl -sS http://127.0.0.1:8502/api/health
```

## 10. ترتیب پیشنهادی ادامه کار

1. بررسی `AGENTS.md` و ADR اعلان
2. ثبت وضعیت dirty worktree و حفظ تغییرات موجود
3. اضافه‌کردن مدل‌ها و migrationهای notification
4. اجرای `prisma format`، `prisma validate` و `prisma generate`
5. نوشتن تست‌های hash/expiry/idempotency/template
6. پیاده‌سازی Bale provider و account-link service
7. پیاده‌سازی link API و webhook
8. پیاده‌سازی outbox repository/dispatcher
9. اتصال transaction ایجاد و تأیید تسک به outbox
10. پیاده‌سازی reminder scanner و worker
11. افزودن process مستقل PM2
12. اجرای lint، typecheck، test و build
13. اجرای migration و smoke test در محیط مقصد

## 11. نکات مهم برای عامل یا توسعه‌دهنده بعدی

- ماژول‌های موجود را از ابتدا بازنویسی نکنید؛ تغییرها کوچک و افزایشی باشند.
- تغییرات کاربر در worktree را reset یا overwrite نکنید.
- هیچ secret یا `.env` را commit نکنید.
- اعلان بله نباید عملیات اصلی Task را fail کند.
- تمام پیام‌ها کوتاه باشند و اطلاعات محرمانه‌ی غیرضروری تسک را نمایش ندهند.
- لینک تسک از `APP_BASE_URL` ساخته شود و فقط برای کاربر مجاز قابل مشاهده باشد.
- وضعیت delivery و خطاها audit شوند، اما payload حساس و tokenها log نشوند.
- rollback باید با غیرفعال‌کردن worker و `NOTIFICATION_WORKER_ENABLED=false` ممکن باشد.
