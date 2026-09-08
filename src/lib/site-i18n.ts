export type Locale = "fa" | "en";

export const LOCALE_COOKIE = "sc_locale";

export function normalizeLocale(value: string | undefined | null): Locale {
  return value === "en" ? "en" : "fa";
}

export function localeDir(locale: Locale) {
  return locale === "en" ? "ltr" : "rtl";
}

export function localizedPath(locale: Locale, path: string) {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  return locale === "en" ? `/en${cleanPath}` : `/fa${cleanPath}`;
}

type Copy = {
  header: {
    brandLine: string;
    brandSubtitle: string;
    solutions: string;
    localeToggleLabel: string;
    localeEnglish: string;
    localePersian: string;
    signIn: string;
    signUp: string;
    account: string;
  };
  home: {
    badge: string;
    title: string;
    description: string;
    primaryCta: string;
    secondaryCta: string;
    metricCompanyBoundaryLabel: string;
    metricCompanyBoundaryValue: string;
    metricSolutionsLabel: string;
    metricSolutionsValue: string;
    metricAccessLabel: string;
    metricAccessValue: string;
    howTitle: string;
    howStep1Title: string;
    howStep1Text: string;
    howStep2Title: string;
    howStep2Text: string;
    howStep3Title: string;
    howStep3Text: string;
    startTitle: string;
    startCta: string;
    featureIsolation: string;
    featureSelection: string;
    featureSecure: string;
  };
  solutions: {
    eyebrow: string;
    title: string;
    description: string;
    openDetails: string;
  };
  signup: {
    eyebrow: string;
    title: string;
    description: string;
    infoCompany: string;
    infoSolution: string;
    infoAccess: string;
    backHome: string;
    companyName: string;
    companySlug: string;
    ownerName: string;
    ownerHandle: string;
    password: string;
    selectSolution: string;
    createCompany: string;
    creatingCompany: string;
    errorFallback: string;
    networkError: string;
  };
  taskplatform: {
    eyebrow: string;
    title: string;
    description: string;
    createCompany: string;
    openApp: string;
    cardTitle: string;
    cardText: string;
    cardAccess: string;
    cardSolution: string;
    cardDeploy: string;
  };
  options: {
    taskplatformName: string;
    insightName: string;
    workflowsName: string;
    taskplatformSlogan: string;
    insightSlogan: string;
    workflowsSlogan: string;
    taskplatformDescription: string;
    insightDescription: string;
    workflowsDescription: string;
  };
};

export const SITE_COPY: Record<Locale, Copy> = {
  fa: {
    header: {
      brandLine: "SolutionCompany",
      brandSubtitle: "پلتفرم راهکارهای سازمانی",
      solutions: "راهکارها",
      localeToggleLabel: "زبان",
      localeEnglish: "English",
      localePersian: "فارسی",
      signIn: "ورود",
      signUp: "ثبت‌نام",
      account: "حساب شما",
    },
    home: {
      badge: "یک وب‌سایت. چند راهکار. هر شرکت فضای خودش را دارد.",
      title: "وب‌سایت چندراهکاری برای شرکت‌ها، با نسخه فارسی و انگلیسی.",
      description:
        "SolutionCompany درگاه ورود سازمان‌هاست. هر شرکت حساب خودش را می‌سازد، راهکار مناسب را انتخاب می‌کند و داخل فضای ایزوله خودش کار می‌کند. TaskPlatform اولین راهکار فعال است.",
      primaryCta: "ساخت حساب شرکت",
      secondaryCta: "مشاهده راهکارها",
      metricCompanyBoundaryLabel: "مرز شرکت",
      metricCompanyBoundaryValue: "هر شرکت = یک tenant",
      metricSolutionsLabel: "راهکارها",
      metricSolutionsValue: "TaskPlatform و بیشتر",
      metricAccessLabel: "دسترسی",
      metricAccessValue: "احراز هویت Clerk",
      howTitle: "چطور کار می‌کند",
      howStep1Title: "ایجاد شرکت",
      howStep1Text: "ثبت‌نام، شرکت را می‌سازد، حساب مالک را ایجاد می‌کند و راهکار را به آن متصل می‌کند.",
      howStep2Title: "انتخاب راهکار",
      howStep2Text: "در حال حاضر TaskPlatform فعال است و می‌توان بعداً راهکارهای دیگر اضافه کرد.",
      howStep3Title: "ورود به کنسول",
      howStep3Text: "مالک شرکت وارد کنسول می‌شود و فقط داده‌های همان شرکت را می‌بیند.",
      startTitle: "هر شرکت یک سایت عمومی، یک ثبت‌نام روشن و یک کنسول خصوصی دارد.",
      startCta: "ساخت شرکت",
      featureIsolation: "جداسازی داده و دسترسی برای هر شرکت",
      featureSelection: "انتخاب راهکار هنگام ثبت‌نام",
      featureSecure: "دسترسی امن با Clerk",
    },
    solutions: {
      eyebrow: "راهکارها",
      title: "راهکاری را انتخاب کنید که به شرکت شما می‌خورد.",
      description:
        "با TaskPlatform شروع کنید و بعداً بدون تغییر ساختار حساب شرکت، محصول‌های بیشتری اضافه کنید.",
      openDetails: "باز کردن جزئیات",
    },
    signup: {
      eyebrow: "ایجاد حساب شرکت",
      title: "راهکار را انتخاب کنید و داخل tenant خودتان شروع کنید.",
      description:
        "ابتدا با Clerk وارد شوید، سپس این فرم شرکت را می‌سازد، حساب مالک اول را ایجاد می‌کند و راهکار انتخاب‌شده را به آن متصل می‌کند.",
      infoCompany: "شناسه شرکت",
      infoSolution: "انتخاب راهکار",
      infoAccess: "دسترسی مستقیم",
      backHome: "بازگشت به صفحه اصلی",
      companyName: "نام شرکت",
      companySlug: "اسلاگ شرکت",
      ownerName: "نام مالک",
      ownerHandle: "هندل مالک",
      password: "رمز عبور",
      selectSolution: "انتخاب راهکار",
      createCompany: "ساخت شرکت",
      creatingCompany: "در حال ساخت شرکت...",
      errorFallback: "امکان ساخت حساب شرکت وجود ندارد.",
      networkError: "خطای شبکه هنگام ساخت حساب.",
    },
    taskplatform: {
      eyebrow: "راهکار",
      title: "TaskPlatform",
      description:
        "پلتفرم عملیات سازمانی برای تیم‌هایی که برنامه‌ریزی تسک، تایید، زمان‌بندی و پیام‌رسانی را در یک workspace می‌خواهند.",
      createCompany: "ساخت شرکت TaskPlatform",
      openApp: "باز کردن برنامه",
      cardTitle: "ساخته شده برای جداسازی tenant",
      cardText: "این پلتفرم طوری در حال تکمیل است که هر شرکت حساب، راهکار و مرز دسترسی خودش را داشته باشد.",
      cardAccess: "دسترسی کنترل‌شده توسط شرکت",
      cardSolution: "راهکار هنگام ثبت‌نام انتخاب می‌شود",
      cardDeploy: "مسیر استقرار آماده برای Vercel",
    },
    options: {
      taskplatformName: "TaskPlatform",
      insightName: "Insight",
      workflowsName: "Workflows",
      taskplatformSlogan: "اجرای تسک و عملیات",
      insightSlogan: "تحلیل و گزارش",
      workflowsSlogan: "اتوماسیون فرایند",
      taskplatformDescription: "ثبت تسک، تایید، زمان‌بندی و پیام‌رسانی در یک workspace سازمانی.",
      insightDescription: "محیط تحلیل و گزارش برای تصمیم‌های سریع‌تر.",
      workflowsDescription: "محیط اتوماسیون فرایند برای تیم‌های چندبخشی.",
    },
  },
  en: {
    header: {
      brandLine: "SolutionCompany",
      brandSubtitle: "Company solutions platform",
      solutions: "Solutions",
      localeToggleLabel: "Language",
      localeEnglish: "English",
      localePersian: "فارسی",
      signIn: "Sign in",
      signUp: "Sign up",
      account: "Your account",
    },
    home: {
      badge: "One website. Multiple solutions. Each company gets its own workspace.",
      title: "A company solutions website with both Persian and English versions.",
      description:
        "SolutionCompany is the front door for organizations. Each company creates an account, selects the right solution, and works inside an isolated tenant. TaskPlatform is the first live solution.",
      primaryCta: "Create a company account",
      secondaryCta: "Browse solutions",
      metricCompanyBoundaryLabel: "Company boundary",
      metricCompanyBoundaryValue: "One tenant per company",
      metricSolutionsLabel: "Solutions",
      metricSolutionsValue: "TaskPlatform and more",
      metricAccessLabel: "Access",
      metricAccessValue: "Clerk authentication",
      howTitle: "How it works",
      howStep1Title: "Create a company",
      howStep1Text: "Signup creates the company, the owner account, and links the chosen solution.",
      howStep2Title: "Select a solution",
      howStep2Text: "TaskPlatform is live now and more product lines can be added later.",
      howStep3Title: "Open the console",
      howStep3Text: "The owner lands in the console and only sees data for their own company.",
      startTitle: "Each company gets a public site, a clear signup flow, and a private console.",
      startCta: "Create company",
      featureIsolation: "Company-specific data and access boundaries",
      featureSelection: "Solution selection during signup",
      featureSecure: "Secure access with Clerk",
    },
    solutions: {
      eyebrow: "Solutions",
      title: "Choose the solution that fits your company.",
      description:
        "Start with TaskPlatform today and add more product lines later without changing your company account structure.",
      openDetails: "Open details",
    },
    signup: {
      eyebrow: "Create a company account",
      title: "Pick a solution and start inside your own tenant.",
      description:
        "Sign in with Clerk first, then this form creates the company, the first owner account, and binds the selected solution to that company.",
      infoCompany: "Company identity",
      infoSolution: "Solution selection",
      infoAccess: "Direct access",
      backHome: "Back to home",
      companyName: "Company name",
      companySlug: "Company slug",
      ownerName: "Owner name",
      ownerHandle: "Owner handle",
      password: "Password",
      selectSolution: "Select solution",
      createCompany: "Create company",
      creatingCompany: "Creating company...",
      errorFallback: "Unable to create company account.",
      networkError: "Network error while creating the account.",
    },
    taskplatform: {
      eyebrow: "Solution",
      title: "TaskPlatform",
      description:
        "A company-scoped operations platform for teams that need task planning, approvals, scheduling, and messaging in one workspace.",
      createCompany: "Create a TaskPlatform company",
      openApp: "Open the app",
      cardTitle: "Built for tenant isolation",
      cardText: "Each company gets its own account, solution choice, and access boundary.",
      cardAccess: "Company-controlled access",
      cardSolution: "Solution selected at signup",
      cardDeploy: "Vercel-ready deployment path",
    },
    options: {
      taskplatformName: "TaskPlatform",
      insightName: "Insight",
      workflowsName: "Workflows",
      taskplatformSlogan: "Task execution and operations",
      insightSlogan: "Analytics and reporting",
      workflowsSlogan: "Process automation",
      taskplatformDescription: "Task intake, approvals, scheduling, and messaging in one company workspace.",
      insightDescription: "Analytics and reporting workspace for faster decisions.",
      workflowsDescription: "Process automation workspace for cross-functional teams.",
    },
  },
};

export function getSiteCopy(locale: Locale) {
  return SITE_COPY[locale];
}
