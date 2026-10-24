import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithRedirect,
  getRedirectResult,
} from 'firebase/auth';
import { auth } from './firebase';
import { toast } from 'sonner';
import { safeLocalStorage, safeSessionStorage } from './utils';

export interface AppUser {
  uid: string;
  email?: string | null;
  displayName?: string | null;
  photoURL?: string | null;
  isGuest?: boolean;
}

const DEFAULT_WORKSPACE_USER: AppUser = {
  uid: 'shared_workspace',
  email: 'workspace@tradinglog.local',
  displayName: 'Shared Workspace',
  isGuest: true,
};

interface AuthContextType {
  user: User | AppUser | null;
  loading: boolean;
  login: () => Promise<void>;
  loginAsGuest: () => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: DEFAULT_WORKSPACE_USER,
  loading: false,
  login: async () => {},
  loginAsGuest: () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | AppUser | null>(() => {
    if (safeSessionStorage.getItem('explicit_logged_out') === 'true') {
      return null;
    }
    return auth.currentUser || DEFAULT_WORKSPACE_USER;
  });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      if (u) {
        safeSessionStorage.removeItem('explicit_logged_out');
        setUser(u);
      } else if (safeSessionStorage.getItem('explicit_logged_out') === 'true') {
        setUser(null);
      } else {
        setUser(DEFAULT_WORKSPACE_USER);
      }
      setLoading(false);
    });

    try {
      getRedirectResult(auth).catch((error) => {
        if (error && error.code !== 'auth/no-recent-redirect-operation') {
          console.warn("Redirect result notice:", error);
        }
      });
    } catch (e) {
      // Ignore
    }

    return () => {
      unsubscribe();
    };
  }, []);

  const loginAsGuest = () => {
    safeSessionStorage.removeItem('explicit_logged_out');
    safeLocalStorage.setItem('guest_session_active', 'true');
    setUser(DEFAULT_WORKSPACE_USER);
    toast.success("已進入系統工作區");
  };

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const isMobile = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIframe = typeof window !== 'undefined' && window.self !== window.top;

      if (isMobile || isIframe) {
        try {
          const res = await signInWithPopup(auth, provider);
          if (res?.user) {
            safeSessionStorage.removeItem('explicit_logged_out');
            safeLocalStorage.removeItem('guest_session_active');
            setUser(res.user);
          }
        } catch (error: any) {
          console.warn("Popup sign-in notice:", error);
          if (isIframe) {
            safeSessionStorage.removeItem('explicit_logged_out');
            setUser(DEFAULT_WORKSPACE_USER);
            toast.success("已自動切換至共享工作區模式");
          } else {
            await signInWithRedirect(auth, provider);
          }
        }
      } else {
        try {
          const res = await signInWithPopup(auth, provider);
          if (res?.user) {
            safeSessionStorage.removeItem('explicit_logged_out');
            safeLocalStorage.removeItem('guest_session_active');
            setUser(res.user);
          }
        } catch (error: any) {
          if (error.code === 'auth/popup-blocked') {
            toast.error("登入視窗被瀏覽器阻擋，請允許彈出式視窗後再次點擊");
          } else if (error.code !== 'auth/cancelled-popup-request') {
            await signInWithRedirect(auth, provider);
          }
        }
      }
    } catch (error) {
      console.warn("General Login failed:", error);
      toast.error("嘗試登入時發生錯誤");
    }
  };

  const logout = async () => {
    safeLocalStorage.removeItem('guest_session_active');
    safeSessionStorage.setItem('explicit_logged_out', 'true');
    try {
      await signOut(auth);
    } catch (error) {
      console.warn("Logout notice:", error);
    }
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, loginAsGuest, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
