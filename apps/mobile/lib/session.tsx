import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Platform } from "react-native";
import { queryClient, setApiToken, setUnauthorizedHandler } from "./api";
import { API_URL } from "./config";
import { storage } from "./storage";

const TOKEN_KEY = "money.session-token";

export type SignInResult = { ok: true } | { ok: false; message: string };

interface Session {
  /** True until the saved token (if any) has been read. */
  isLoading: boolean;
  signedIn: boolean;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<Session | null>(null);

export function useSession(): Session {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error("useSession must be used inside <SessionProvider>");
  return ctx;
}

/**
 * The auth endpoints check the Origin header. React Native sends none, and a missing Origin is
 * normally fine, but the server also rejects requests that look browser-made without one.
 * Sending the server's own address is always trusted and removes the ambiguity. Browsers set
 * Origin themselves (and forbid setting it), so the web preview skips this.
 */
const originHeader: Record<string, string> = Platform.OS === "web" ? {} : { origin: API_URL };

function describeFailure(status: number): string {
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  if (status === 401) return "Wrong email or password.";
  return `Something went wrong on the server (${status}). Try again in a moment.`;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const clear = useCallback(async () => {
    setApiToken(null);
    setToken(null);
    queryClient.clear();
    await storage.remove(TOKEN_KEY);
  }, []);

  // Restore the saved token on launch.
  useEffect(() => {
    let cancelled = false;
    storage.get(TOKEN_KEY).then((saved) => {
      if (cancelled) return;
      setApiToken(saved);
      setToken(saved);
      setIsLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Any 401 from the API means the session is gone: go back to the sign-in screen.
  useEffect(() => {
    setUnauthorizedHandler(() => void clear());
    return () => setUnauthorizedHandler(null);
  }, [clear]);

  const signIn = useCallback<Session["signIn"]>(async (email, password) => {
    try {
      const res = await fetch(`${API_URL}/api/auth/sign-in/email`, {
        method: "POST",
        headers: { "content-type": "application/json", ...originHeader },
        credentials: "omit",
        body: JSON.stringify({ email: email.trim(), password }),
      });
      if (!res.ok) return { ok: false, message: describeFailure(res.status) };
      // The bearer plugin returns the signed token in this header.
      const value = res.headers.get("set-auth-token");
      if (!value) return { ok: false, message: "The server didn't return a session. Try again." };
      await storage.set(TOKEN_KEY, value);
      setApiToken(value);
      setToken(value);
      return { ok: true };
    } catch {
      return { ok: false, message: "Can't reach the server. Check your connection." };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (token) {
      // Best effort: revoke the session on the server, but sign out locally no matter what.
      try {
        await fetch(`${API_URL}/api/auth/sign-out`, {
          method: "POST",
          headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json",
            ...originHeader,
          },
          credentials: "omit",
          body: "{}",
        });
      } catch {
        // offline; the local token is removed below
      }
    }
    await clear();
  }, [token, clear]);

  const value = useMemo<Session>(
    () => ({ isLoading, signedIn: token !== null, signIn, signOut }),
    [isLoading, token, signIn, signOut],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
