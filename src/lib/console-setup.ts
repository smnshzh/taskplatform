export const CONSOLE_SETUP_COOKIE = "sc_console_setup";

export function hasCookie(cookieHeader: string | null | undefined, name: string) {
  if (!cookieHeader) {
    return false;
  }

  return cookieHeader
    .split(";")
    .some((segment) => segment.trim().startsWith(`${name}=`));
}

export function hasConsoleSetupCookie(cookieHeader: string | null | undefined) {
  return hasCookie(cookieHeader, CONSOLE_SETUP_COOKIE);
}
