// Storage utilities for local data persistence

const STORAGE_KEYS = {
  AUTH_TOKEN: 'storyteller_auth_token',
  USER_DATA: 'storyteller_user',
  ACTIVE_PROFILE: 'storyteller_active_profile',
  PROFILES: 'storyteller_profiles',
  PROGRESS: 'storyteller_progress',
  GAME_RESULTS: 'storyteller_game_results',
  PARENT_PROFILE: 'storyteller_parent_profile',
  PARENT_CONTROL: 'storyteller_parent_control',
} as const;

export class StorageService {
  static setItem<T>(key: keyof typeof STORAGE_KEYS, value: T): void {
    try {
      localStorage.setItem(STORAGE_KEYS[key], JSON.stringify(value));
    } catch (error) {
      console.error('Failed to save to localStorage:', error);
    }
  }

  static getItem<T>(key: keyof typeof STORAGE_KEYS): T | null {
    try {
      const item = localStorage.getItem(STORAGE_KEYS[key]);
      return item ? JSON.parse(item) : null;
    } catch (error) {
      console.error('Failed to read from localStorage:', error);
      return null;
    }
  }

  static removeItem(key: keyof typeof STORAGE_KEYS): void {
    try {
      localStorage.removeItem(STORAGE_KEYS[key]);
    } catch (error) {
      console.error('Failed to remove from localStorage:', error);
    }
  }

  static clear(): void {
    try {
      Object.values(STORAGE_KEYS).forEach(key => {
        localStorage.removeItem(key);
      });
    } catch (error) {
      console.error('Failed to clear localStorage:', error);
    }
  }

  // Specific helper methods
  static saveAuthToken(token: string): void {
    this.setItem('AUTH_TOKEN', token);
  }

  static getAuthToken(): string | null {
    return this.getItem('AUTH_TOKEN');
  }

  static clearAuthToken(): void {
    this.removeItem('AUTH_TOKEN');
  }

  static saveUserData(user: any): void {
    this.setItem('USER_DATA', user);
  }

  static getUserData(): any {
    return this.getItem('USER_DATA');
  }

  static saveActiveProfile(profile: any): void {
    this.setItem('ACTIVE_PROFILE', profile);
  }

  static getActiveProfile(): any {
    return this.getItem('ACTIVE_PROFILE');
  }
}