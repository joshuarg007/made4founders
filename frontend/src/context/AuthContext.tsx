import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8001';

interface User {
  email: string;
  name: string | null;
  role: string;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name?: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

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

  const login = async (email: string, password: string) => {
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

    await fetchUser();
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

  return (
    <AuthContext.Provider
      value={{
        user,
        isLoading,
        isAuthenticated: !!user,
        login,
        register,
        logout,
        refreshUser,
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
