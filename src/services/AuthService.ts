// Local Authentication Service - Easily swappable for Auth0/Firebase later

import { User, ChildProfile } from '@/types';
import { StorageService } from '@/lib/storage';

export interface AuthProvider {
  login(email: string, password: string): Promise<{ user: User; token: string }>;
  signup(email: string, password: string): Promise<{ user: User; token: string }>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<User | null>;
  validateToken(token: string): Promise<boolean>;
}

// Mock user database - In production, this would be replaced with real API calls
const MOCK_USERS: Record<string, { id: string; email: string; password: string; createdAt: string }> = {
  'demo@storyteller.com': {
    id: 'user_1',
    email: 'demo@storyteller.com', 
    password: 'demo123',
    createdAt: new Date().toISOString()
  }
};

export class LocalAuthService implements AuthProvider {
  private generateUserId(): string {
    return `user_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private generateToken(): string {
    return `token_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
  }

  async login(email: string, password: string): Promise<{ user: User; token: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 800));

    // Check if user exists
    const userData = MOCK_USERS[email];
    if (!userData || userData.password !== password) {
      throw new Error('Invalid email or password');
    }

    const user: User = {
      id: userData.id,
      email: userData.email,
      createdAt: userData.createdAt
    };

    const token = this.generateToken();
    
    // Store auth data
    StorageService.saveAuthToken(token);
    StorageService.saveUserData(user);

    return { user, token };
  }

  async signup(email: string, password: string): Promise<{ user: User; token: string }> {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Check if user already exists
    if (MOCK_USERS[email]) {
      throw new Error('User already exists with this email');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      throw new Error('Please enter a valid email address');
    }

    // Validate password
    if (password.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const userId = this.generateUserId();
    const now = new Date().toISOString();

    // Store user (in real app, this would be an API call)
    MOCK_USERS[email] = {
      id: userId,
      email,
      password,
      createdAt: now
    };

    const user: User = {
      id: userId,
      email,
      createdAt: now
    };

    const token = this.generateToken();

    // Store auth data
    StorageService.saveAuthToken(token);
    StorageService.saveUserData(user);

    return { user, token };
  }

  async logout(): Promise<void> {
    StorageService.clearAuthToken();
    StorageService.removeItem('USER_DATA');
    StorageService.removeItem('ACTIVE_PROFILE');
  }

  async getCurrentUser(): Promise<User | null> {
    const token = StorageService.getAuthToken();
    if (!token) return null;

    const isValid = await this.validateToken(token);
    if (!isValid) {
      await this.logout();
      return null;
    }

    return StorageService.getUserData();
  }

  async validateToken(token: string): Promise<boolean> {
    // In a real app, this would validate with your backend
    // For demo purposes, we'll just check if token exists and has correct format
    return token.startsWith('token_') && token.length > 20;
  }
}

// Singleton instance - easy to swap with other providers
export const authService = new LocalAuthService();

// Example of how to swap providers:
// export const authService = new Auth0Service();
// export const authService = new FirebaseAuthService();