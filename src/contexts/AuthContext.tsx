import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api, setMemoryAdminToken, setMemoryUserToken } from '../lib/api';
import { DEFAULT_PUBLIC_SETTINGS } from '../lib/constants';

export interface UserData {
  id: string;
  uid: string;
  full_name: string;
  username: string;
  email: string;
  phone: string;
  referral_code: string;
  referred_by?: string | null;
  sponsor_username?: string | null;
  status: string;
  role?: string;
  preferred_language?: string;
  avatar_url?: string | null;
  created_at?: string;
}

export interface WalletData {
  balance: number;
  available_balance: number;
  locked_balance: number;
  pending_balance: number;
  total_balance: number;
  total_deposited: number;
  total_withdrawn: number;
  total_commission: number;
  total_spent: number;
}

export interface AdminData {
  id: string;
  admin_uid: string;
  full_name: string;
  email: string;
  role_id: number;
  role_slug: string;
  role_name: string;
  permissions: string[];
}

export interface SignUpInput {
  fullName?: string;
  username?: string;
  email: string;
  phone: string;
  password: string;
  referralCode?: string;
}

interface AuthContextValue {
  user: UserData | null;
  wallet: WalletData | null;
  unreadCount: number;
  userUnread: number;
  admin: AdminData | null;
  adminUnreadCount: number;
  adminUnread: number;
  adminVaultUnlocked: boolean;
  adminSetupRequired: boolean;
  googleOAuthEnabled: boolean;
  publicSettings: Record<string, string>;
  loading: boolean;
  authLoading: boolean;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (input: SignUpInput) => Promise<void>;
  signInWithGoogle: (referralCode?: string) => Promise<void>;
  sendResetEmail: (email: string) => Promise<void>;
  resetPasswordWithToken: (token: string, newPassword: string, confirmPassword: string) => Promise<void>;
  signInAdminWithPasscode: (passcode: string) => Promise<AdminData>;
  setupInitialAdminPassword: (password: string) => Promise<AdminData>;
  lockAdminVault: () => void;
  hasAdminPermission: (permission: string) => boolean;
  refreshUser: () => Promise<void>;
  refreshAdmin: () => Promise<void>;
  refreshPublicSettings: () => Promise<void>;
  logoutUser: () => Promise<void>;
  logoutAdmin: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<UserData | null>(null);
  const [wallet, setWallet] = useState<WalletData | null>(null);
  const [unreadCount, setUnreadCount] = useState(0);

  const [admin, setAdmin] = useState<AdminData | null>(null);
  const [adminUnreadCount, setAdminUnreadCount] = useState(0);
  const [adminVaultUnlocked, setAdminVaultUnlocked] = useState(false);
  const [adminSetupRequired, setAdminSetupRequired] = useState(false);
  const [googleOAuthEnabled, setGoogleOAuthEnabled] = useState(false);

  const [publicSettings, setPublicSettings] = useState<Record<string, string>>(DEFAULT_PUBLIC_SETTINGS);
  const [loading, setLoading] = useState(true);

  const refreshPublicSettings = useCallback(async () => {
    try {
      const res = await api.publicGet('/api/public/settings');
      if (res.data) {
        setPublicSettings({ ...DEFAULT_PUBLIC_SETTINGS, ...res.data });
      }
    } catch {
      // keep defaults if server is starting
    }
  }, []);

  const refreshUser = useCallback(async () => {
    try {
      const res = await api.userGet('/api/auth/me');
      setUser(res.data?.user || null);
      setWallet(res.data?.wallet || null);
      setUnreadCount(Number(res.data?.unread_notifications || 0));
    } catch {
      setUser(null);
      setWallet(null);
      setUnreadCount(0);
    }
  }, []);

  const refreshAdmin = useCallback(async () => {
    try {
      const res = await api.adminGet('/api/admin/auth/me');
      if (res.data?.admin) {
        setAdmin(res.data.admin);
        setAdminUnreadCount(Number(res.data.unread_notifications || 0));
        setAdminVaultUnlocked(true);
      } else {
        setAdmin(null);
        setAdminVaultUnlocked(false);
      }
    } catch {
      setAdmin(null);
      setAdminUnreadCount(0);
      setAdminVaultUnlocked(false);
    }
  }, []);

  const refreshAdminStatus = useCallback(async () => {
    try {
      const res = await api.publicGet('/api/admin/status');
      setAdminSetupRequired(Boolean(res.data?.setup_required));
    } catch {
      setAdminSetupRequired(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    const init = async () => {
      await Promise.allSettled([
        refreshPublicSettings(),
        refreshUser(),
        refreshAdmin(),
        refreshAdminStatus(),
        api
          .publicGet('/api/auth/google/status')
          .then((r) => {
            if (active) setGoogleOAuthEnabled(Boolean(r.data?.enabled));
          })
          .catch(() => {}),
      ]);
      if (active) setLoading(false);
    };
    init();
    return () => {
      active = false;
    };
  }, [refreshPublicSettings, refreshUser, refreshAdmin, refreshAdminStatus]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    const res = await api.publicPost('/api/auth/login', {
      identifier: email.trim().toLowerCase(),
      password,
    });
    if (res.data?.session_token) {
      setMemoryUserToken(res.data.session_token);
    }
    setUser(res.data?.user || null);
    setWallet(res.data?.wallet || null);
    setUnreadCount(Number(res.data?.unread_notifications || 0));
  }, []);

  const signUpWithEmail = useCallback(async (input: SignUpInput) => {
    const cleanEmail = input.email.trim().toLowerCase();
    const emailPrefix = cleanEmail.split('@')[0].replace(/[^a-z0-9]/gi, '').toLowerCase() || 'member';
    const derivedFullName = (input.fullName || '').trim() || emailPrefix;
    const derivedUsername =
      (input.username || '').trim().toLowerCase().replace(/[^a-z0-9._-]/g, '') ||
      `${emailPrefix.slice(0, 14)}${Math.floor(100 + Math.random() * 899)}`;

    const res = await api.publicPost('/api/auth/register', {
      full_name: derivedFullName,
      username: derivedUsername,
      email: cleanEmail,
      phone: input.phone.trim(),
      password: input.password,
      confirm_password: input.password,
      referral_code: input.referralCode?.trim().toUpperCase() || undefined,
    });
    if (res.data?.session_token) {
      setMemoryUserToken(res.data.session_token);
    }
    setUser(res.data?.user || null);
    setWallet(res.data?.wallet || null);
    setUnreadCount(Number(res.data?.unread_notifications || 0));
  }, []);

  const signInWithGoogle = useCallback(
    async (referralCode?: string) => {
      const qs = referralCode ? `?ref=${encodeURIComponent(referralCode)}` : '';
      const res = await api.publicGet(`/api/auth/google/url${qs}`);
      const url = res.data?.url;
      if (!url) throw new Error('Google Sign-In is currently unavailable.');

      await new Promise<void>((resolve, reject) => {
        const popup = window.open(url, 'gopaybd_google_oauth', 'width=520,height=640');
        if (!popup) {
          reject(new Error('Please allow popups for Google Sign-In.'));
          return;
        }

        const onMessage = async (event: MessageEvent) => {
          const data = event.data;
          if (!data || typeof data !== 'object') return;
          if (data.type === 'OAUTH_AUTH_SUCCESS') {
            window.removeEventListener('message', onMessage);
            if (data.session_token) {
              setMemoryUserToken(String(data.session_token));
            }
            await refreshUser();
            resolve();
          } else if (data.type === 'OAUTH_AUTH_ERROR') {
            window.removeEventListener('message', onMessage);
            reject(new Error(data.message || 'Google Sign-In failed.'));
          }
        };

        window.addEventListener('message', onMessage);
        const timer = window.setInterval(() => {
          if (popup.closed) {
            window.clearInterval(timer);
            window.removeEventListener('message', onMessage);
            reject(new Error('Google Sign-In window was closed.'));
          }
        }, 500);
      });
    },
    [refreshUser]
  );

  const sendResetEmail = useCallback(async (email: string) => {
    await api.publicPost('/api/auth/forgot-password', { email: email.trim().toLowerCase() });
  }, []);

  const resetPasswordWithToken = useCallback(
    async (token: string, newPassword: string, confirmPassword: string) => {
      await api.publicPost('/api/auth/reset-password', {
        token: token.trim(),
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
    },
    []
  );

  const signInAdminWithPasscode = useCallback(async (passcode: string): Promise<AdminData> => {
    const res = await api.publicPost('/api/admin/auth/login', { password: passcode });
    if (res.data?.session_token) {
      setMemoryAdminToken(res.data.session_token);
    }
    const adm: AdminData = res.data.admin;
    setAdmin(adm);
    setAdminVaultUnlocked(true);
    setAdminSetupRequired(false);
    return adm;
  }, []);

  const setupInitialAdminPassword = useCallback(async (password: string): Promise<AdminData> => {
    const res = await api.publicPost('/api/admin/auth/setup', { password });
    if (res.data?.session_token) {
      setMemoryAdminToken(res.data.session_token);
    }
    const adm: AdminData = res.data.admin;
    setAdmin(adm);
    setAdminVaultUnlocked(true);
    setAdminSetupRequired(false);
    return adm;
  }, []);

  const logoutUser = useCallback(async () => {
    try {
      await api.userPost('/api/auth/logout');
    } catch {
      // ignore
    }
    setMemoryUserToken(null);
    setUser(null);
    setWallet(null);
    setUnreadCount(0);
  }, []);

  const logoutAdmin = useCallback(async () => {
    try {
      await api.adminPost('/api/admin/auth/logout');
    } catch {
      // ignore
    }
    setMemoryAdminToken(null);
    setAdmin(null);
    setAdminUnreadCount(0);
    setAdminVaultUnlocked(false);
  }, []);

  const lockAdminVault = useCallback(() => {
    setAdminVaultUnlocked(false);
  }, []);

  const hasAdminPermission = useCallback(
    (permission: string): boolean => {
      if (!admin) return false;
      const perms = admin.permissions || [];
      return perms.includes('*') || perms.includes(permission);
    },
    [admin]
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        wallet,
        unreadCount,
        userUnread: unreadCount,
        admin,
        adminUnreadCount,
        adminUnread: adminUnreadCount,
        adminVaultUnlocked,
        adminSetupRequired,
        googleOAuthEnabled,
        publicSettings,
        loading,
        authLoading: loading,
        signInWithEmail,
        signUpWithEmail,
        signInWithGoogle,
        sendResetEmail,
        resetPasswordWithToken,
        signInAdminWithPasscode,
        setupInitialAdminPassword,
        lockAdminVault,
        hasAdminPermission,
        refreshUser,
        refreshAdmin,
        refreshPublicSettings,
        logoutUser,
        logoutAdmin,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
