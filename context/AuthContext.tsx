"use client";

import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

type AuthContextValue = {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isConfigured: boolean;
  isEmailVerified: boolean;
  signOut: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const isConfigured = isSupabaseConfigured();

  const refreshUser = useCallback(async () => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      setUser(null);
      setSession(null);
    } else {
      setUser(data.user);
      const { data: sessionData } = await supabase.auth.getSession();
      setSession(sessionData.session);
    }
    setIsLoading(false);
  }, [isConfigured]);

  useEffect(() => {
    if (!isConfigured) {
      setIsLoading(false);
      return;
    }

    const supabase = createClient();

    void refreshUser();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setIsLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [isConfigured, refreshUser]);

  const signOut = useCallback(async () => {
    if (!isConfigured) return;
    const supabase = createClient();
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, [isConfigured]);

  const isEmailVerified = Boolean(user?.email_confirmed_at);

  const value = useMemo(
    () => ({
      user,
      session,
      isLoading,
      isConfigured,
      isEmailVerified,
      signOut,
      refreshUser,
    }),
    [user, session, isLoading, isConfigured, isEmailVerified, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
