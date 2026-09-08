"use client";

import {
  SignInButton,
  SignUpButton,
  Show,
  UserButton,
} from "@clerk/nextjs";

const triggerClass =
  "inline-flex h-10 items-center justify-center rounded-xl px-4 text-sm font-semibold transition";

export function AuthControls() {
  return (
    <div className="flex items-center gap-2">
      <Show when="signed-out">
        <SignInButton mode="modal">
          <button
            className={`${triggerClass} border border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50`}
          >
            ورود
          </button>
        </SignInButton>
        <SignUpButton mode="modal">
          <button
            className={`${triggerClass} bg-slate-950 text-white hover:bg-slate-800`}
          >
            ثبت‌نام
          </button>
        </SignUpButton>
      </Show>
      <Show when="signed-in">
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-1.5 shadow-sm">
          <span className="text-xs font-medium text-slate-500">حساب شما</span>
          <UserButton />
        </div>
      </Show>
    </div>
  );
}
