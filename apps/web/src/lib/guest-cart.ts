"use client";
/**
 * Guest cart (owner 2026-11-25): visitors shop without an account. Only course ids are kept in this browser's
 * localStorage (nothing personal); prices and availability always come from the API (POST /cart/preview), and the
 * list is merged into the account's cart right after sign-in (POST /cart/merge), so it survives registration,
 * the authenticator setup and provider sign-ins.
 */
const KEY = "del-guest-cart";
const EVT = "del-guest-cart";
const MAX = 50;

export function guestCart(): string[] {
  try {
    const v = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => typeof x === "string" && /^[0-9a-f-]{36}$/i.test(x)).slice(0, MAX) : [];
  } catch { return []; }
}
function save(ids: string[]) {
  try { localStorage.setItem(KEY, JSON.stringify(Array.from(new Set(ids)).slice(0, MAX))); } catch { /* storage blocked */ }
  try { window.dispatchEvent(new Event(EVT)); } catch { /* server */ }
}
export const addGuest = (id: string) => save([...guestCart(), id]);
export const removeGuest = (id: string) => save(guestCart().filter((x) => x !== id));
export const clearGuest = () => save([]);
export function onGuestCart(fn: () => void) {
  window.addEventListener(EVT, fn);
  window.addEventListener("storage", fn);
  return () => { window.removeEventListener(EVT, fn); window.removeEventListener("storage", fn); };
}
