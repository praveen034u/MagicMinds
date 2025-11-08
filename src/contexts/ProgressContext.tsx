import React, { createContext, useContext, useReducer, ReactNode } from 'react';
import { Progress, GameResult, Badge } from '@/types';
import { StorageService } from '@/lib/storage';
import { StreakCalculator } from '@/lib/streak';
import { useAppContext } from '@/contexts/Auth0Context';

interface ProgressContextType {
  progress: Progress | null;
  updateGameResult: (result: GameResult) => void;
  getBadges: () => Badge[];
}

const ProgressContext = createContext<ProgressContextType | undefined>(undefined);

const AVAILABLE_BADGES: Badge[] = [
  {
    id: 'riddle_master',
    title: 'Riddle Master 🧠',
    description: 'Answer 20 riddles correctly',
    icon: '🧠',
    requirement: { type: 'total_correct', gameId: 'riddle', value: 20 }
  },
  {
    id: 'word_wizard',
    title: 'Word Wizard 📚',
    description: 'Coming soon...',
    icon: '📚',
    requirement: { type: 'total_correct', gameId: 'vocabulary', value: 15 }
  }
];

export function ProgressProvider({ children }: { children: ReactNode }) {
  const { selectedChild } = useAppContext();
  const [progress, setProgress] = React.useState<Progress | null>(null);

  React.useEffect(() => {
    if (selectedChild) {
      loadProgress();
    }
  }, [selectedChild]);

  const loadProgress = () => {
    if (!selectedChild) return;
    
    const saved = StorageService.getItem('PROGRESS') as Progress | null;
    if (saved && saved.profileId === selectedChild.id) {
      setProgress(saved);
    } else {
      const newProgress: Progress = {
        profileId: selectedChild.id,
        stars: 0,
        badges: [],
        streak: { current: 0, longest: 0, lastPlayedISO: null },
        perGame: {}
      };
      setProgress(newProgress);
      StorageService.setItem('PROGRESS', newProgress);
    }
  };

  const updateGameResult = (result: GameResult) => {
    if (!progress) return;

    const updatedProgress = { ...progress };
    
    // Update stars
    updatedProgress.stars += result.starsEarned;
    
    // Update streak
    updatedProgress.streak = StreakCalculator.updateStreak(updatedProgress.streak);
    
    // Update per-game stats
    if (!updatedProgress.perGame[result.gameId]) {
      updatedProgress.perGame[result.gameId] = {
        played: 0,
        correct: 0,
        stars: 0,
        lastPlayedISO: null
      };
    }
    
    const gameStats = updatedProgress.perGame[result.gameId];
    gameStats.played += 1;
    gameStats.correct += result.correct;
    gameStats.stars += result.starsEarned;
    gameStats.lastPlayedISO = result.endedAt;

    // Check for new badges
    AVAILABLE_BADGES.forEach(badge => {
      if (updatedProgress.badges.includes(badge.id)) return;
      
      if (badge.requirement.type === 'total_correct' && badge.requirement.gameId) {
        const stats = updatedProgress.perGame[badge.requirement.gameId];
        if (stats && stats.correct >= badge.requirement.value) {
          updatedProgress.badges.push(badge.id);
        }
      }
    });

    setProgress(updatedProgress);
    StorageService.setItem('PROGRESS', updatedProgress);
  };

  const getBadges = () => {
    return AVAILABLE_BADGES.filter(badge => 
      progress?.badges.includes(badge.id)
    );
  };

  return (
    <ProgressContext.Provider value={{ progress, updateGameResult, getBadges }}>
      {children}
    </ProgressContext.Provider>
  );
}

export const useProgress = () => {
  const context = useContext(ProgressContext);
  if (!context) throw new Error('useProgress must be used within ProgressProvider');
  return context;
};