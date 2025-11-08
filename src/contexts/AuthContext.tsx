import React, { createContext, useContext, useReducer, useEffect, ReactNode } from 'react';
import { User, ChildProfile, ParentProfile, ParentControl, AuthState } from '@/types';
import { authService } from '@/services/AuthService';
import { StorageService } from '@/lib/storage';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType extends AuthState {
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  setActiveProfile: (profile: ChildProfile | null) => void;
  setParentProfile: (profile: ParentProfile | null) => void;
  setParentControl: (control: ParentControl | null) => void;
  refreshAuth: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

type AuthAction =
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'SET_ACTIVE_PROFILE'; payload: ChildProfile | null }
  | { type: 'SET_PARENT_PROFILE'; payload: ParentProfile | null }
  | { type: 'SET_PARENT_CONTROL'; payload: ParentControl | null }
  | { type: 'LOGOUT' };

function authReducer(state: AuthState, action: AuthAction): AuthState {
  switch (action.type) {
    case 'SET_LOADING':
      return { ...state, isLoading: action.payload };
    case 'SET_USER':
      return {
        ...state,
        user: action.payload,
        isAuthenticated: action.payload !== null,
        isLoading: false,
      };
    case 'SET_ACTIVE_PROFILE':
      return { ...state, activeProfile: action.payload };
    case 'SET_PARENT_PROFILE':
      return { ...state, parentProfile: action.payload };
    case 'SET_PARENT_CONTROL':
      return { ...state, parentControl: action.payload };
    case 'LOGOUT':
      return {
        user: null,
        activeProfile: null,
        parentProfile: null,
        parentControl: null,
        isLoading: false,
        isAuthenticated: false,
      };
    default:
      return state;
  }
}

const initialState: AuthState = {
  user: null,
  activeProfile: null,
  parentProfile: null,
  parentControl: null,
  isLoading: true,
  isAuthenticated: false,
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(authReducer, initialState);
  const { toast } = useToast();

  // Initialize auth state on app load
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const user = await authService.getCurrentUser();
      dispatch({ type: 'SET_USER', payload: user });

      if (user) {
        const activeProfile = StorageService.getActiveProfile();
        const parentProfile = StorageService.getItem<ParentProfile>('PARENT_PROFILE');
        const parentControl = StorageService.getItem<ParentControl>('PARENT_CONTROL');
        
        dispatch({ type: 'SET_ACTIVE_PROFILE', payload: activeProfile });
        dispatch({ type: 'SET_PARENT_PROFILE', payload: parentProfile });
        dispatch({ type: 'SET_PARENT_CONTROL', payload: parentControl });
      }
    } catch (error) {
      console.error('Failed to initialize auth:', error);
      dispatch({ type: 'SET_USER', payload: null });
    }
  };

  const login = async (email: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const { user } = await authService.login(email, password);
      dispatch({ type: 'SET_USER', payload: user });
      
      toast({
        title: "Welcome back! 🎉",
        description: "Great to see you again! Let's have some fun.",
      });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      toast({
        title: "Login Failed 😔",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const signup = async (email: string, password: string) => {
    try {
      dispatch({ type: 'SET_LOADING', payload: true });
      
      const { user } = await authService.signup(email, password);
      dispatch({ type: 'SET_USER', payload: user });
      
      toast({
        title: "Account Created! 🌟",
        description: "Welcome to StoryTeller Kids! Let's set up your child's profile.",
      });
    } catch (error) {
      dispatch({ type: 'SET_LOADING', payload: false });
      toast({
        title: "Signup Failed 😔",
        description: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await authService.logout();
      dispatch({ type: 'LOGOUT' });
      
      toast({
        title: "See you later! 👋",
        description: "Thanks for playing with us today!",
      });
    } catch (error) {
      console.error('Logout failed:', error);
      toast({
        title: "Logout Error",
        description: "Something went wrong during logout.",
        variant: "destructive",
      });
    }
  };

  const setActiveProfile = (profile: ChildProfile | null) => {
    dispatch({ type: 'SET_ACTIVE_PROFILE', payload: profile });
    StorageService.saveActiveProfile(profile);
  };

  const setParentProfile = (profile: ParentProfile | null) => {
    dispatch({ type: 'SET_PARENT_PROFILE', payload: profile });
    StorageService.setItem('PARENT_PROFILE', profile);
  };

  const setParentControl = (control: ParentControl | null) => {
    dispatch({ type: 'SET_PARENT_CONTROL', payload: control });
    StorageService.setItem('PARENT_CONTROL', control);
  };

  const refreshAuth = async () => {
    await initializeAuth();
  };

  const value: AuthContextType = {
    ...state,
    login,
    signup,
    logout,
    setActiveProfile,
    setParentProfile,
    setParentControl,
    refreshAuth,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}