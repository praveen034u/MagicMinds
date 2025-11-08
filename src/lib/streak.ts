// Streak calculation utilities

import { format, isToday, isYesterday, parseISO, differenceInDays } from 'date-fns';

export interface StreakData {
  current: number;
  longest: number;
  lastPlayedISO: string | null;
}

export class StreakCalculator {
  /**
   * Updates streak based on the last played date
   * Rules:
   * - If played today: maintain current streak
   * - If played yesterday: continue streak
   * - If gap > 1 day: reset streak to 1
   * - Update longest if current > longest
   */
  static updateStreak(currentStreak: StreakData): StreakData {
    const now = new Date();
    
    if (!currentStreak.lastPlayedISO) {
      // First time playing
      return {
        current: 1,
        longest: Math.max(1, currentStreak.longest),
        lastPlayedISO: now.toISOString()
      };
    }

    const lastPlayed = parseISO(currentStreak.lastPlayedISO);
    
    if (isToday(lastPlayed)) {
      // Already played today, don't change streak
      return currentStreak;
    }
    
    let newCurrent: number;
    
    if (isYesterday(lastPlayed)) {
      // Continue the streak
      newCurrent = currentStreak.current + 1;
    } else {
      // Gap > 1 day, reset streak
      newCurrent = 1;
    }
    
    return {
      current: newCurrent,
      longest: Math.max(newCurrent, currentStreak.longest),
      lastPlayedISO: now.toISOString()
    };
  }

  /**
   * Get streak calendar data for display
   * Returns array of dates with play status
   */
  static getStreakCalendar(gameResults: Array<{ endedAt: string }>, days = 30): Array<{
    date: string;
    played: boolean;
    isToday: boolean;
  }> {
    const today = new Date();
    const calendar: Array<{ date: string; played: boolean; isToday: boolean }> = [];
    
    // Get unique play dates
    const playDates = new Set(
      gameResults.map(result => format(parseISO(result.endedAt), 'yyyy-MM-dd'))
    );
    
    // Generate calendar for last N days
    for (let i = days - 1; i >= 0; i--) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const dateString = format(date, 'yyyy-MM-dd');
      
      calendar.push({
        date: dateString,
        played: playDates.has(dateString),
        isToday: i === 0
      });
    }
    
    return calendar;
  }

  /**
   * Check if user has played today
   */
  static hasPlayedToday(lastPlayedISO: string | null): boolean {
    if (!lastPlayedISO) return false;
    return isToday(parseISO(lastPlayedISO));
  }
}