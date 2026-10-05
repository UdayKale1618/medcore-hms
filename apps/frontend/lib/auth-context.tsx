'use client';

// ============================================================
// MEDCORE HMS - AUTHENTICATION STATE & RBAC CONTEXT
// ============================================================

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
} from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { api, setStoredToken, getStoredToken } from './api';
import type { AuthUser, UserRole } from './types';

interface AuthContextType {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  hasRole: (roles: UserRole | UserRole[]) => boolean;
  isSuperAdmin: boolean;
  isHospitalAdmin: boolean;
  isDoctor: boolean;
  isNurse: boolean;
  isReceptionist: boolean;
  isLabTechnician: boolean;
  isPharmacist: boolean;
  isAccountant: boolean;
  isPatient: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const PUBLIC_ROUTES = [
  '/login',
  '/forgot-password',
  '/verify-otp',
  '/reset-password',
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const router = useRouter();
  const pathname = usePathname();

  const refreshUser = useCallback(async () => {
    try {
      const stored = getStoredToken();
      if (!stored) {
        setUser(null);
        setToken(null);
        setIsLoading(false);
        return;
      }

      const response = await api.get<{ message: string; user: AuthUser }>(
        '/auth/me',
      );
      setUser(response.user);
      setToken(stored);
    } catch {
      setUser(null);
      setToken(null);
      setStoredToken(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    let ignore = false;
    async function initAuth() {
      const stored = getStoredToken();
      if (!stored) {
        await Promise.resolve();
        if (!ignore) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const response = await api.get<{ message: string; user: AuthUser }>(
          '/auth/me',
        );
        if (!ignore) {
          setUser(response.user);
          setToken(stored);
        }
      } catch {
        if (!ignore) {
          setUser(null);
          setToken(null);
          setStoredToken(null);
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    initAuth();
    return () => {
      ignore = true;
    };
  }, []);

  // Route protection
  useEffect(() => {
    if (isLoading) return;

    const isPublic = PUBLIC_ROUTES.some((route) => pathname.startsWith(route));

    if (!user && !isPublic) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
    } else if (user && isPublic) {
      router.push('/dashboard');
    }
  }, [user, isLoading, pathname, router]);

  const login = async (email: string, password: string): Promise<AuthUser> => {
    setIsLoading(true);
    try {
      const response = await api.post<{
        message: string;
        accessToken: string;
        user: {
          id: string;
          email: string;
          name: string;
          role: UserRole;
          hospitalId: string;
          roleId: string;
        };
      }>('/auth/login', { email, password }, { skipAuth: true });

      const authUser: AuthUser = {
        userId: response.user.id,
        id: response.user.id,
        name: response.user.name,
        email: response.user.email,
        role: response.user.role,
        roleId: response.user.roleId,
        hospitalId: response.user.hospitalId,
      };

      setStoredToken(response.accessToken);
      setToken(response.accessToken);
      setUser(authUser);
      return authUser;
    } finally {
      setIsLoading(false);
    }
  };

  const logout = async () => {
    setIsLoading(true);
    try {
      await api.post('/auth/logout', {}).catch(() => {});
    } finally {
      setStoredToken(null);
      setToken(null);
      setUser(null);
      setIsLoading(false);
      router.push('/login');
    }
  };

  const hasRole = useCallback(
    (roles: UserRole | UserRole[]): boolean => {
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true; // Super admin has universal access
      if (Array.isArray(roles)) {
        return roles.includes(user.role);
      }
      return user.role === roles;
    },
    [user],
  );

  const roleFlags = useMemo(
    () => ({
      isSuperAdmin: user?.role === 'SUPER_ADMIN',
      isHospitalAdmin: user?.role === 'HOSPITAL_ADMIN',
      isDoctor: user?.role === 'DOCTOR',
      isNurse: user?.role === 'NURSE',
      isReceptionist: user?.role === 'RECEPTIONIST',
      isLabTechnician: user?.role === 'LAB_TECHNICIAN',
      isPharmacist: user?.role === 'PHARMACIST',
      isAccountant: user?.role === 'ACCOUNTANT',
      isPatient: user?.role === 'PATIENT',
    }),
    [user],
  );

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        login,
        logout,
        refreshUser,
        hasRole,
        ...roleFlags,
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
