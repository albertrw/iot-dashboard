import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { login as apiLogin, me as apiMe, register as apiRegister, type AuthUser } from "../api/auth";

type AuthContextValue = {
  token: string | null;
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  setSession: (token: string, user: AuthUser) => void;
  updateUser: (user: AuthUser) => void;
  logout: () => void;
};

const TOKEN_KEY = "auth_token";

const Ctx = createContext<AuthContextValue | null>(null);

function readToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function writeToken(token: string | null) {
  try {
    if (!token) localStorage.removeItem(TOKEN_KEY);
    else localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // ignore
  }
  try {
    window.dispatchEvent(new Event("auth_token_changed"));
  } catch {
    // ignore
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readToken());
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState<boolean>(() => Boolean(readToken()));

  useEffect(() => {
    const sync = () => {
      const t = readToken();
      setToken(t);
      if (!t) {
        setLoading(false);
        setUser(null);
        return;
      }

      setLoading(true);
      apiMe()
        .then((r) => setUser(r.user))
        .catch(() => {
          writeToken(null);
          setToken(null);
          setUser(null);
        })
        .finally(() => setLoading(false));
    };

    sync();
    window.addEventListener("auth_token_changed", sync);
    return () => window.removeEventListener("auth_token_changed", sync);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      token,
      user,
      loading,
      async login(email: string, password: string) {
        const res = await apiLogin({ email, password });
        writeToken(res.token);
        setToken(res.token);
        setUser(res.user);
      },
      async register(email: string, password: string) {
        const res = await apiRegister({ email, password });
        writeToken(res.token);
        setToken(res.token);
        setUser(res.user);
      },
      setSession(nextToken: string, nextUser: AuthUser) {
        writeToken(nextToken);
        setToken(nextToken);
        setUser(nextUser);
      },
      updateUser(nextUser: AuthUser) {
        setUser(nextUser);
      },
      logout() {
        writeToken(null);
        setToken(null);
        setUser(null);
      },
    }),
    [token, user, loading]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useAuth() {
  const v = useContext(Ctx);
  if (!v) throw new Error("AuthProvider missing");
  return v;
}
