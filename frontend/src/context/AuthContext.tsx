import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface User {
  email: string;
  name: string | null;
  role: string;
  has_completed_onboarding: boolean;
}

interface MFAPendingState {
  mfaToken: string;
  email: string;
}

interface MFASetupRequiredState {
  setupToken: string;
  email: string;
}

interface LoginResult {
  success: boolean;
  mfaRequired?: boolean;
  mfaSetupRequired?: boolean;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  isViewer: boolean;
  canEdit: boolean;
  mfaPending: MFAPendingState | null;
  mfaSetupRequired: MFASetupRequiredState | null;
  login: (email: string, password: string) => Promise<LoginResult>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  verifyMfa: (code: string) => Promise<void>;
  clearMfaPending: () => void;
  clearMfaSetupRequired: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [mfaPending, setMfaPending] = useState<MFAPendingState | null>(null);
  const [mfaSetupRequired, setMfaSetupRequired] = useState<MFASetupRequiredState | null>(null);

  const fetchUser = async () => {
    try {
      const res = await fetch(`${API_URL}/api/auth/me`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data);
      } else {
        setUser(null);
      }
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  const login = async (email: string, password: string): Promise<LoginResult> => {
    const formData = new URLSearchParams();
    formData.append('username', email);
    formData.append('password', password);

    const res = await fetch(`${API_URL}/api/auth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData,
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Login failed');
    }

    const data = await res.json();

    // Check if MFA verification is required (user has MFA enabled)
    if (data.mfa_required && data.mfa_token) {
      setMfaPending({ mfaToken: data.mfa_token, email });
      return { success: false, mfaRequired: true };
    }

    // Check if MFA setup is required (user doesn't have MFA)
    if (data.mfa_setup_required && data.setup_token) {
      setMfaSetupRequired({ setupToken: data.setup_token, email });
      return { success: false, mfaSetupRequired: true };
    }

    // Normal login success
    await fetchUser();
    return { success: true };
  };

  const verifyMfa = async (code: string) => {
    if (!mfaPending) {
      throw new Error('No MFA verification pending');
    }

    const res = await fetch(`${API_URL}/api/auth/token/mfa`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        mfa_token: mfaPending.mfaToken,
        code,
      }),
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Invalid MFA code');
    }

    setMfaPending(null);
    await fetchUser();
  };

  const clearMfaPending = () => {
    setMfaPending(null);
  };

  const clearMfaSetupRequired = () => {
    setMfaSetupRequired(null);
  };

  const register = async (email: string, password: string, name?: string) => {
    const res = await fetch(`${API_URL}/api/auth/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ email, password, name }),
      credentials: 'include',
    });

    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.detail || 'Registration failed');
    }

    await fetchUser();
  };

  const logout = async () => {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    setUser(null);
  };

  const refreshUser = async () => {
    await fetchUser();
  };

  const isViewer = user?.role === 'viewer';
  const canEdit = !!user && user.role !== 'viewer';

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        isViewer,
        canEdit,
        mfaPending,
        mfaSetupRequired,
        login,
        register,
        logout,
        refreshUser,
        verifyMfa,
        clearMfaPending,
        clearMfaSetupRequired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
