import React, { createContext, useContext, useEffect, useState } from 'react';
import { 
  User, 
  onAuthStateChanged, 
  signInWithPopup, 
  GoogleAuthProvider, 
  signOut,
  signInWithRedirect,
  getRedirectResult
} from 'firebase/auth';
import { auth } from './firebase';
import { toast } from 'sonner';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  login: async () => {},
  logout: async () => {},
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });

    // Handle redirect result if any
    getRedirectResult(auth).catch((error) => {
      if (error.code !== 'auth/no-recent-redirect-operation') {
        console.error("Redirect result error:", error);
        toast.error("登入失敗，請稍後再試");
      }
    });

    return () => unsubscribe();
  }, []);

  const login = async () => {
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({ prompt: 'select_account' });

      const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
      const isIframe = window.self !== window.top;

      if (isMobile) {
        // Always try popup first, but if it fails on mobile, fall back to redirect and tell user to configure
        try {
          await signInWithPopup(auth, provider);
        } catch (error: any) {
          console.error("Popup failed, trying redirect", error);
          if (isIframe) {
            toast.error("手機版於預覽畫面中可能無法登入，建議「以新分頁開啟」或使用桌面版", { duration: 5000 });
          }
          await signInWithRedirect(auth, provider);
        }
      } else {
        // Desktop
        try {
          await signInWithPopup(auth, provider);
        } catch (error: any) {
          if (error.code === 'auth/popup-blocked') {
            toast.error("登入視窗被阻擋，請允許彈出式視窗或手動點擊再次嘗試");
          } else if (error.code === 'auth/cancelled-popup-request') {
            // Ignore cancel
          } else {
            console.error("Login failed:", error);
            if (!isIframe) await signInWithRedirect(auth, provider);
          }
        }
      }
    } catch (error) {
      console.error("General Login failed:", error);
      toast.error("嘗試登入時發生錯誤");
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
