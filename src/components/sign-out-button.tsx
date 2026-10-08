"use client";

import { postJson } from "@/lib/api-client";

export function SignOutButton() {
  async function signOut() {
    await postJson("/api/auth/logout");
    // A full page load, not a client-side navigation, so nothing rendered for
    // the previous user survives in the router cache.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  return (
    <button
      type="button"
      onClick={signOut}
      className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold whitespace-nowrap text-slate-100 ring-1 ring-white/25 transition-colors duration-150 hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white"
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 20 20"
        className="size-4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M8 4H5.5A1.5 1.5 0 0 0 4 5.5v9A1.5 1.5 0 0 0 5.5 16H8m4.5-9 3 3-3 3m3-3H8" />
      </svg>
      Sign out
    </button>
  );
}
