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

/** Where httpClient looks for the session token. */
const TOKEN_KEY = 'authToken';

/**
 * Put a signed-in user away, with the token kept apart from the user object.
 *
 * Separate on purpose: the user object goes to Sentry, to localStorage and
 * through component props, and a credential riding along inside it would
 * travel everywhere the user's name does. Returns the user without it.
 */
const storeSession = (user: User & { token?: string | null }): User => {
  const { token, ...withoutToken } = user;

  try {
    if (token) {
      localStorage.setItem(TOKEN_KEY, token);
    } else {
      // No token means the server issued none — carry on unauthenticated
      // rather than leaving a stale one from a previous session in place.
      localStorage.removeItem(TOKEN_KEY);
    }
    localStorage.setItem('currentUser', JSON.stringify(withoutToken));
  } catch (error) {
    console.warn('Could not persist the session:', error);
  }

  return withoutToken;
};

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
        
        // Every sign-in goes to the server, administrators included. The
        // browser used to mint its own admin here whenever the typed password
        // matched VITE_GLOBAL_PASSW, which gave every administrator the same
        // id ('admin') and kept the password in the client bundle.
        const user = await findUserByIMEI(imei, password);
        
        if (user) {
          const session = storeSession(user);
          setCurrentUser(session);

          // Set Sentry user context
          setSentryUser({
            id: session.id,
            username: session.name,
            role: session.role
          });

          resolve(session);
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
        
        const user: User & { token?: string | null } = await response.json();

        const session = storeSession(user);
        setCurrentUser(session);

        // Set Sentry user context
        setSentryUser({
          id: session.id,
          username: session.name,
          role: session.role
        });

        resolve(session);
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
    localStorage.removeItem(TOKEN_KEY);

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