import { useState, useEffect, useCallback } from 'react';

export interface AuthUser {
  id: number;
  username: string;
  displayName: string | null;
  bio: string | null;
  avatarColor: string;
  avatarUrl: string | null;
  email?: string | null;
  emailVerified?: boolean;
}

const BASE = import.meta.env.BASE_URL.replace(/\/$/, '');
const CACHE_KEY = 'lrmtv_auth_user';

function readCache(): AuthUser | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

function writeCache(u: AuthUser | null) {
  try {
    if (u) localStorage.setItem(CACHE_KEY, JSON.stringify(u));
    else localStorage.removeItem(CACHE_KEY);
  } catch {}
}

export async function apiFetch(path: string, opts?: RequestInit) {
  return fetch(`${BASE}/api${path}`, {
    ...opts,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(opts?.headers || {}) },
  });
}

export function useAuth() {
  // Initialise from cache so components can render immediately without spinner
  const cached = readCache();
  const [user, setUserState] = useState<AuthUser | null | undefined>(cached ?? undefined);
  // If we have a cached user, we're not "loading" from UI perspective
  const [loading, setLoading] = useState(!cached);

  const setUser = useCallback((u: AuthUser | null | undefined) => {
    setUserState(u);
    if (u === undefined) return;
    writeCache(u ?? null);
  }, []);

  useEffect(() => {
    apiFetch('/auth/me')
      .then(r => r.ok ? r.json() : null)
      .then((freshUser: AuthUser | null) => {
        setUser(freshUser);
      })
      .catch(() => {
        // Network error — keep cached user rather than logging out
      })
      .finally(() => setLoading(false));
  }, []);

  const register = useCallback(async (username: string, password: string) => {
    const r = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ username, password }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'خطأ في التسجيل');
    setUser(data);
    return data as AuthUser;
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const r = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'خطأ في تسجيل الدخول');
    setUser(data);
    return data as AuthUser;
  }, []);

  const logout = useCallback(async () => {
    await apiFetch('/auth/logout', { method: 'POST' });
    writeCache(null);
    setUserState(null);
  }, []);

  const updateProfile = useCallback(async (updates: {
    displayName?: string;
    bio?: string;
    avatarColor?: string;
    avatarUrl?: string;
    username?: string;
    currentPassword?: string;
    newPassword?: string;
  }) => {
    const r = await apiFetch('/auth/profile', { method: 'PATCH', body: JSON.stringify(updates) });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'خطأ في تحديث الملف');
    setUser(data);
    return data as AuthUser;
  }, []);

  return { user, loading, setUser, register, login, logout, updateProfile };
}
