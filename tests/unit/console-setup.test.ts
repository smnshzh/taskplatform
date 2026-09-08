import { describe, expect, it } from "vitest";
import {
  CONSOLE_SETUP_COOKIE,
  hasConsoleSetupCookie,
  hasCookie,
} from "@/lib/console-setup";

describe("console setup cookie", () => {
  it("detects the console setup marker in a cookie header", () => {
    expect(
      hasCookie(`foo=1; ${CONSOLE_SETUP_COOKIE}=1; bar=2`, CONSOLE_SETUP_COOKIE)
    ).toBe(true);
    expect(hasConsoleSetupCookie(`${CONSOLE_SETUP_COOKIE}=1`)).toBe(true);
  });

  it("ignores other cookies", () => {
    expect(hasConsoleSetupCookie("foo=1; bar=2")).toBe(false);
  });
});
