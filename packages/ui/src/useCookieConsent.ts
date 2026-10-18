"use client";

import { useSyncExternalStore } from "react";

const key = "lm-cookie-consent";
const changeEvent = "lm-cookie-consent-updated";
let fallback: string | null = null;

function subscribe(notify: () => void) {
  window.addEventListener("storage", notify);
  window.addEventListener(changeEvent, notify);
  return () => {
    window.removeEventListener("storage", notify);
    window.removeEventListener(changeEvent, notify);
  };
}

function hasChoice() {
  try { return Boolean(localStorage.getItem(key) || fallback); }
  catch { return Boolean(fallback); }
}

export function useCookieConsent() {
  const chosen = useSyncExternalStore(subscribe, hasChoice, () => true);
  const choose = (choice: "accepted" | "declined") => {
    fallback = choice;
    try { localStorage.setItem(key, choice); } catch { /* Keep the choice for this page when storage is unavailable. */ }
    window.dispatchEvent(new Event(changeEvent));
  };
  return { visible: !chosen, choose };
}
