// Core Types for StoryTeller App

export interface User {
  id: string;
  email: string;
  createdAt: string;
  hasCompletedProfile?: boolean;
  hasParentProfile?: boolean;
}

export interface ChildProfile {
  id: string;
  userId: string;
  name: string;
  ageGroup: 'toddler' | 'preschool' | 'elementary' | 'tween';
  avatar: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParentProfile {
  id: string;
  userId: string;
  name: string;
  email: string;
  createdAt: string;
  updatedAt: string;
}

export interface ParentControl {
  id: string;
  userId: string;
  childProfileId: string;
  screenTime: {
    dailyLimitMinutes: number;
    startTime: string; // "09:00"
    endTime: string; // "20:00"
    enabled: boolean;
  };
  bedTime: {
    time: string; // "21:00"
    enabled: boolean;
    warningMinutes: number; // minutes before bedtime to show warning
  };
  createdAt: string;
  updatedAt: string;
}

export interface GameConfig {
  id: string;
  title: string;
  icon: string;
  enabled: boolean;
  difficulties: string[];
  dataSource: string;
  scoring: {
    correct: number;
    streakBonus?: number;
  };
  description: string;
  theme?: string;
}

export interface GameResult {
  gameId: string;
  profileId: string;
  difficulty: string;
  correct: number;
  total: number;
  starsEarned: number;
  theme?: string;
  endedAt: string;
}

export interface Progress {
  profileId: string;
  stars: number;
  badges: string[];
  streak: {
    current: number;
    longest: number;
    lastPlayedISO: string | null;
  };
  perGame: Record<string, {
    played: number;
    correct: number;
    stars: number;
    lastPlayedISO: string | null;
  }>;
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  requirement: {
    type: 'total_correct' | 'streak' | 'games_played' | 'stars_earned';
    gameId?: string;
    value: number;
  };
}

// Game-specific types
export interface RiddleQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  theme: string;
  difficulty: string;
  hint?: string;
}

export type Riddle = RiddleQuestion;

export interface CrosswordWord {
  id: number;
  word: string;
  clue: string;
  direction: 'across' | 'down';
  startRow: number;
  startCol: number;
  number: number;
}

export interface CrosswordPuzzle {
  gridSize: number;
  words: CrosswordWord[];
}

export interface StorySegment {
  id: string;
  title: string;
  content: string;
  imageUrl?: string;
  choices?: {
    text: string;
    nextSegmentId: string;
  }[];
  isEnding: boolean;
}

// Auth types
export interface AuthState {
  user: User | null;
  activeProfile: ChildProfile | null;
  parentProfile: ParentProfile | null;
  parentControl: ParentControl | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}