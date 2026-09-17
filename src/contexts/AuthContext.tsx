import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { findUserByIMEI } from '../api/authService';
import { apiFetch } from '../api/httpClient';
import { setUser as setSentryUser } from '../lib/sentry';

// Define user interface with IMEI information
export interface User {
  id: string;
  name: string;
  username?: string; // Username for self-registered users (used as identifier for catches)
  role: 'admin' | 'user' | 'demo';
  imeis: string[]; // List of IMEIs user has access to
  community?: string;
  region?: string;
  isDemoMode?: boolean;
  hasImei?: boolean; // Flag to indicate if user has a tracking device (IMEI)
}

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  login: (imei: string, password: string) => Promise<User>;
  loginDemo: () => Promise<User>;
  logout: () => void;
  updateUserImeis: (imeis: string[]) => void;
  isAuthenticated: boolean;
  isDemoMode: boolean;
}

// Create the authentication context
const AuthContext = createContext<AuthContextType | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check if user is stored in localStorage
    const storedUser = localStorage.getItem('currentUser');
    if (storedUser) {
      setCurrentUser(JSON.parse(storedUser));
    }
    setLoading(false);
  }, []);

  // Login function that accepts IMEI and password
  const login = async (imei: string, password: string): Promise<User> => {
    return new Promise((resolve, reject) => {
      (async () => {
      try {
        setLoading(true);
        
        // Check for global admin password
        const globalPassword = import.meta.env.VITE_GLOBAL_PASSW;
        if (password === globalPassword) {
          // If global password matches, create an admin user with no IMEIs (they can select vessels)
          const adminUser: User = {
            id: 'admin',
            name: 'Administrator',
            role: 'admin',
            imeis: [], // Admin users start with no IMEIs and can select any vessel
          };
          setCurrentUser(adminUser);
          localStorage.setItem('currentUser', JSON.stringify(adminUser));

          // Set Sentry user context
          setSentryUser({
            id: adminUser.id,
            username: adminUser.name,
            role: adminUser.role
          });

          resolve(adminUser);
          return;
        }
        
        // If not global password, try MongoDB authentication
        const user = await findUserByIMEI(imei, password);
        
        if (user) {
          setCurrentUser(user);
          localStorage.setItem('currentUser', JSON.stringify(user));

          // Set Sentry user context
          setSentryUser({
            id: user.id,
            username: user.name,
            role: user.role
          });

          resolve(user);
        } else {
          reject(new Error('Invalid IMEI or password'));
        }
      } catch (error) {
        console.error('Login error:', error);
        reject(new Error('Error during login'));
      } finally {
        setLoading(false);
      }
      })().catch(reject);
    });
  };

  // Demo login function
  const loginDemo = async (): Promise<User> => {
    return new Promise((resolve, reject) => {
      (async () => {
      setLoading(true);
      
      try {
        // Call the secure demo login API endpoint
        const response = await apiFetch('/auth/demo-login', {
          method: 'POST',
          body: {} // No credentials needed - backend handles them
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
          reject(new Error(errorData.error || 'Demo login failed'));
          return;
        }
        
        const user: User = await response.json();

        setCurrentUser(user);
        localStorage.setItem('currentUser', JSON.stringify(user));

        // Set Sentry user context
        setSentryUser({
          id: user.id,
          username: user.name,
          role: user.role
        });

        resolve(user);
      } catch (error) {
        console.error('Demo login error:', error);
        reject(new Error('Error during demo login'));
      } finally {
        setLoading(false);
      }
      })().catch(reject);
    });
  };

  const logout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');

    // Clear Sentry user context
    setSentryUser(null);
  };

  const updateUserImeis = (imeis: string[]) => {
    setCurrentUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, imeis };
      localStorage.setItem('currentUser', JSON.stringify(updated));
      return updated;
    });
  };

  const value = {
    currentUser,
    loading,
    login,
    loginDemo,
    logout,
    updateUserImeis,
    isAuthenticated: !!currentUser,
    isDemoMode: currentUser?.isDemoMode || false
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

// Custom hook to use the auth context
export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 