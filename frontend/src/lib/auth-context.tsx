'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { api } from '@/lib/api-client';

export interface MerchantProfile {
  id: string;
  name: string;
  businessName: string;
  email: string;
  status: string;
}

interface AuthContextType {
  apiKey: string | null;
  merchant: MerchantProfile | null;
  credentialId: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  login: (key: string) => Promise<boolean>;
  logout: () => void;
  refreshMerchant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const STORAGE_KEY = 'payment_gateway_api_key';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [merchant, setMerchant] = useState<MerchantProfile | null>(null);
  const [credentialId, setCredentialId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const verifyAndLoadMerchant = useCallback(async (key: string): Promise<boolean> => {
    setIsLoading(true);
    setError(null);
    try {
      // 1. Verify API Key with /auth/me
      const authResponse = await api.get<{
        status: string;
        data: { merchantId: string; credentialId: string };
      }>('/auth/me', { apiKey: key });

      const merchantId = authResponse.data.merchantId;
      const credId = authResponse.data.credentialId;

      // 2. Fetch Merchant Details with /merchants/:id
      const merchantResponse = await api.get<MerchantProfile>(`/merchants/${merchantId}`);

      setApiKey(key);
      setMerchant(merchantResponse);
      setCredentialId(credId);
      if (typeof window !== 'undefined') {
        sessionStorage.setItem(STORAGE_KEY, key);
      }
      return true;
    } catch (err: any) {
      setError(err?.message || 'Invalid or expired API Key');
      setApiKey(null);
      setMerchant(null);
      setCredentialId(null);
      if (typeof window !== 'undefined') {
        sessionStorage.removeItem(STORAGE_KEY);
      }
      return false;
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check sessionStorage on initial client mount
    if (typeof window !== 'undefined') {
      const storedKey = sessionStorage.getItem(STORAGE_KEY);
      if (storedKey) {
        verifyAndLoadMerchant(storedKey);
      } else {
        setIsLoading(false);
      }
    } else {
      setIsLoading(false);
    }
  }, [verifyAndLoadMerchant]);

  const login = async (key: string) => {
    return verifyAndLoadMerchant(key.trim());
  };

  const logout = () => {
    setApiKey(null);
    setMerchant(null);
    setCredentialId(null);
    setError(null);
    if (typeof window !== 'undefined') {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  };

  const refreshMerchant = async () => {
    if (apiKey) {
      await verifyAndLoadMerchant(apiKey);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        apiKey,
        merchant,
        credentialId,
        isAuthenticated: !!apiKey && !!merchant,
        isLoading,
        error,
        login,
        logout,
        refreshMerchant,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
