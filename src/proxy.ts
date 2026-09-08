import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import type { Locale } from "@/lib/site-i18n";

function stripLocalePrefix(pathname: string) {
  if (pathname === "/en" || pathname === "/fa") {
    return { pathname: "/", locale: pathname.slice(1) as Locale };
  }

  if (pathname.startsWith("/en/")) {
    return { pathname: pathname.slice(3) || "/", locale: "en" as const };
  }

  if (pathname.startsWith("/fa/")) {
    return { pathname: pathname.slice(3) || "/", locale: "fa" as const };
  }

  return null;
}

export default clerkMiddleware(async (_auth, request: NextRequest) => {
  const localeRoute = stripLocalePrefix(request.nextUrl.pathname);
  if (localeRoute) {
    const url = request.nextUrl.clone();
    url.pathname = localeRoute.pathname;

    const response = NextResponse.redirect(url);
    response.cookies.set("sc_locale", localeRoute.locale, {
      path: "/",
      sameSite: "lax",
    });
    return response;
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    "/(api|trpc)(.*)",
    "/__clerk/:path*",
  ],
};
