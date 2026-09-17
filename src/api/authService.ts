import { apiFetch } from './httpClient';

// User interfaces - matching our MongoDB structure
export interface MongoUser {
  _id: string;
  IMEI: string;
  Boat: string;
  captain?: string;
  vessel_type?: string;
  Community: string;
  Region: string;
  Country?: string;
  password: string;
}

export interface AppUser {
  id: string;
  name: string;
  imeis: string[];
  role: 'admin' | 'user';
  community?: string;
  region?: string;
  hasImei?: boolean;
  /** Proof of this session, to be sent with later requests. */
  token?: string | null;
}

/**
 * Find a user by IMEI/Boat name and password using the backend API
 */
export async function findUserByIMEI(imei: string, password: string): Promise<AppUser | null> {
  try {
    const response = await apiFetch('/auth/login', {
      method: 'POST',
      body: { imei, password },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        return null;
      }
      throw new Error(`Authentication failed with status: ${response.status}`);
    }
    
    const user = await response.json();
    return user;
  } catch (error) {
    console.error('Error during authentication:', error);
    throw error;
  }
}

/**
 * Get all users 
 */
export async function getAllUsers(): Promise<MongoUser[]> {
  try {
    const response = await apiFetch('/users');
    
    if (!response.ok) {
      throw new Error(`Failed to fetch users with status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error getting all users:', error);
    throw error;
  }
} 