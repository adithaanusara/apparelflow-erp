"use client";

import { postJson } from "@/lib/api-client";
import { secondaryButtonClass } from "./ui";

export function SignOutButton() {
  async function signOut() {
    await postJson("/api/auth/logout");
    // A full page load, not a client-side navigation, so nothing rendered for
    // the previous user survives in the router cache.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/login");
  }

  return (
    <button type="button" onClick={signOut} className={secondaryButtonClass}>
      Sign out
    </button>
  );
}
