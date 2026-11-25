"use client";
import { clearGuest, guestCart, onGuestCart } from "@/lib/guest-cart";
import { createContext, useRef, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { api, setCsrf } from "@/lib/api";
import { list, toMe, obj } from "@/lib/normalize";
import type { Me, Role } from "@/lib/types";

interface AuthState {
  me: Me | null;
  loading: boolean;
  cartCount: number;
  refresh: () => Promise<Me | null>;
  refreshCart: () => Promise<void>;
  logout: () => Promise<void>;
  has: (...roles: Role[]) => boolean;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<Me | null>(null);
  const [loading, setLoading] = useState(true);
  const [cartCount, setCartCount] = useState(0);

  const meRef = useRef<Me | null>(null);
  const refreshCart = useCallback(async () => {
    if (!meRef.current) { setCartCount(guestCart().length); return; }
    try {
      const c = await api("/cart");
      setCartCount(list(c, "items").length);
    } catch {
      setCartCount(0);
    }
  }, []);
  // Guests: the count follows the browser's list (also changes made in another tab).
  useEffect(() => onGuestCart(() => { if (!meRef.current) setCartCount(guestCart().length); }), []);

  const refresh = useCallback(async () => {
    try {
      const r = await api("/auth/me");
      const o = obj(r);
      setCsrf((o.csrf ?? o.csrfToken) as string | undefined);
      const m = toMe(r);
      meRef.current = m;
      setMe(m);
      // Just signed in (any method): move the guest cart into the account, then forget it in this browser.
      const ids = m ? guestCart() : [];
      if (ids.length) { try { await api("/cart/merge", { method: "POST", body: { courseIds: ids } }); clearGuest(); } catch { /* kept for the next try */ } }
      void refreshCart();
      return m;
    } catch {
      setMe(null);
      return null;
    } finally {
      setLoading(false);
    }
  }, [refreshCart]);

  useEffect(() => {
    // Initial session check; state updates happen after the request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
  }, [refresh]);

  const logout = useCallback(async () => {
    try {
      await api("/auth/logout", { method: "POST" });
    } finally {
      meRef.current = null;
      setMe(null);
      setCartCount(guestCart().length);
    }
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      me, loading, cartCount, refresh, refreshCart, logout,
      has: (...roles) => !!me && roles.some((r) => me.roles.includes(r) || (r === "admin" && me.roles.includes("super_admin"))),
    }),
    [me, loading, cartCount, refresh, refreshCart, logout],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useAuth outside AuthProvider");
  return c;
}
