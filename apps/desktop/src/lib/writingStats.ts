/**
 * Writing statistics tracker
 * Stores daily writing stats in localStorage
 */

export interface DailyStats {
  date: string; // YYYY-MM-DD
  wordsWritten: number;
  minutesActive: number;
  notesEdited: number;
  sessionsCount: number;
}

export interface WritingGoals {
  dailyWordGoal: number;
  dailyMinutesGoal: number;
  weeklyWordGoal: number;
  weeklyNotesGoal: number;
  weeklyStreakGoal: number;
}

const STATS_KEY = 'viny-writing-stats';
const GOALS_KEY = 'viny-writing-goals';

function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

function loadStats(): Record<string, DailyStats> {
  try {
    const stored = localStorage.getItem(STATS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

function saveStats(stats: Record<string, DailyStats>): void {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function getTodayStats(): DailyStats {
  const stats = loadStats();
  const today = getToday();

  if (!stats[today]) {
    stats[today] = {
      date: today,
      wordsWritten: 0,
      minutesActive: 0,
      notesEdited: 0,
      sessionsCount: 0,
    };
    saveStats(stats);
  }

  return stats[today];
}

export function updateTodayStats(updates: Partial<DailyStats>): void {
  const stats = loadStats();
  const today = getToday();

  if (!stats[today]) {
    stats[today] = {
      date: today,
      wordsWritten: 0,
      minutesActive: 0,
      notesEdited: 0,
      sessionsCount: 0,
    };
  }

  stats[today] = { ...stats[today], ...updates };
  saveStats(stats);
}

export function addWordsWritten(words: number): void {
  const stats = loadStats();
  const today = getToday();

  if (!stats[today]) {
    stats[today] = {
      date: today,
      wordsWritten: 0,
      minutesActive: 0,
      notesEdited: 0,
      sessionsCount: 0,
    };
  }

  stats[today].wordsWritten += words;
  saveStats(stats);
}

export function incrementNotesEdited(): void {
  const stats = loadStats();
  const today = getToday();

  if (!stats[today]) {
    stats[today] = {
      date: today,
      wordsWritten: 0,
      minutesActive: 0,
      notesEdited: 0,
      sessionsCount: 0,
    };
  }

  stats[today].notesEdited++;
  saveStats(stats);
}

export function addMinutesActive(minutes: number): void {
  const stats = loadStats();
  const today = getToday();

  if (!stats[today]) {
    stats[today] = {
      date: today,
      wordsWritten: 0,
      minutesActive: 0,
      notesEdited: 0,
      sessionsCount: 0,
    };
  }

  stats[today].minutesActive += minutes;
  saveStats(stats);
}

export function incrementSessions(): void {
  const stats = loadStats();
  const today = getToday();

  if (!stats[today]) {
    stats[today] = {
      date: today,
      wordsWritten: 0,
      minutesActive: 0,
      notesEdited: 0,
      sessionsCount: 0,
    };
  }

  stats[today].sessionsCount++;
  saveStats(stats);
}

export function getWeekStats(): DailyStats[] {
  const stats = loadStats();
  const result: DailyStats[] = [];

  for (let i = 6; i >= 0; i--) {
    const date = new Date();
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    result.push(stats[dateStr] || {
      date: dateStr,
      wordsWritten: 0,
      minutesActive: 0,
      notesEdited: 0,
      sessionsCount: 0,
    });
  }

  return result;
}

export function getCurrentStreak(): number {
  const stats = loadStats();
  let streak = 0;
  const today = new Date();

  // Check if today has activity
  const todayStr = today.toISOString().split('T')[0];
  if (stats[todayStr]?.wordsWritten > 0) {
    streak = 1;
  }

  // Check previous days
  for (let i = 1; i < 365; i++) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);
    const dateStr = date.toISOString().split('T')[0];

    if (stats[dateStr]?.wordsWritten > 0) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}

export function getLongestStreak(): number {
  const stats = loadStats();
  const dates = Object.keys(stats).sort();

  if (dates.length === 0) return 0;

  let longest = 0;
  let current = 0;
  let prevDate: Date | null = null;

  for (const dateStr of dates) {
    if (stats[dateStr].wordsWritten === 0) {
      current = 0;
      prevDate = null;
      continue;
    }

    const date = new Date(dateStr);

    if (prevDate) {
      const diffDays = Math.floor((date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24));
      if (diffDays === 1) {
        current++;
      } else {
        current = 1;
      }
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
    prevDate = date;
  }

  return longest;
}

export function getTotalStats(): { totalWords: number; totalMinutes: number; totalDays: number } {
  const stats = loadStats();
  let totalWords = 0;
  let totalMinutes = 0;
  let totalDays = 0;

  for (const day of Object.values(stats)) {
    if (day.wordsWritten > 0) {
      totalWords += day.wordsWritten;
      totalMinutes += day.minutesActive;
      totalDays++;
    }
  }

  return { totalWords, totalMinutes, totalDays };
}

export function getWritingGoals(): WritingGoals {
  try {
    const stored = localStorage.getItem(GOALS_KEY);
    const defaults: WritingGoals = {
      dailyWordGoal: 500,
      dailyMinutesGoal: 30,
      weeklyWordGoal: 3500,
      weeklyNotesGoal: 10,
      weeklyStreakGoal: 5,
    };
    return stored ? { ...defaults, ...JSON.parse(stored) } : defaults;
  } catch {
    return {
      dailyWordGoal: 500,
      dailyMinutesGoal: 30,
      weeklyWordGoal: 3500,
      weeklyNotesGoal: 10,
      weeklyStreakGoal: 5,
    };
  }
}

export function setWritingGoals(goals: WritingGoals): void {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
}

export function getDayName(dateStr: string): string {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (dateStr === today.toISOString().split('T')[0]) return 'Today';
  if (dateStr === yesterday.toISOString().split('T')[0]) return 'Yesterday';

  return date.toLocaleDateString('en-US', { weekday: 'short' });
}

// Get the start of the current week (Monday)
function getWeekStart(): Date {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const diff = today.getDate() - dayOfWeek + (dayOfWeek === 0 ? -6 : 1);
  const monday = new Date(today);
  monday.setDate(diff);
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export interface WeeklyProgress {
  wordsWritten: number;
  wordsGoal: number;
  wordsProgress: number;
  notesEdited: number;
  notesGoal: number;
  notesProgress: number;
  daysActive: number;
  streakGoal: number;
  streakProgress: number;
  dailyBreakdown: DailyStats[];
  weekNumber: number;
  weekStart: string;
  weekEnd: string;
}

export function getWeeklyProgress(): WeeklyProgress {
  const stats = loadStats();
  const goals = getWritingGoals();
  const weekStart = getWeekStart();
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 6);

  const dailyBreakdown: DailyStats[] = [];
  let wordsWritten = 0;
  let notesEdited = 0;
  let daysActive = 0;

  for (let i = 0; i < 7; i++) {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + i);
    const dateStr = date.toISOString().split('T')[0];

    const dayStat = stats[dateStr] || {
      date: dateStr,
      wordsWritten: 0,
      minutesActive: 0,
      notesEdited: 0,
      sessionsCount: 0,
    };

    dailyBreakdown.push(dayStat);
    wordsWritten += dayStat.wordsWritten;
    notesEdited += dayStat.notesEdited;

    if (dayStat.wordsWritten > 0) {
      daysActive++;
    }
  }

  // Calculate week number
  const startOfYear = new Date(weekStart.getFullYear(), 0, 1);
  const pastDaysOfYear = (weekStart.getTime() - startOfYear.getTime()) / 86400000;
  const weekNumber = Math.ceil((pastDaysOfYear + startOfYear.getDay() + 1) / 7);

  return {
    wordsWritten,
    wordsGoal: goals.weeklyWordGoal,
    wordsProgress: Math.min(100, Math.round((wordsWritten / goals.weeklyWordGoal) * 100)),
    notesEdited,
    notesGoal: goals.weeklyNotesGoal,
    notesProgress: Math.min(100, Math.round((notesEdited / goals.weeklyNotesGoal) * 100)),
    daysActive,
    streakGoal: goals.weeklyStreakGoal,
    streakProgress: Math.min(100, Math.round((daysActive / goals.weeklyStreakGoal) * 100)),
    dailyBreakdown,
    weekNumber,
    weekStart: weekStart.toISOString().split('T')[0],
    weekEnd: weekEnd.toISOString().split('T')[0],
  };
}

export interface MonthlyStats {
  month: string;
  year: number;
  totalWords: number;
  totalNotes: number;
  totalMinutes: number;
  daysActive: number;
  avgWordsPerDay: number;
  bestDay: { date: string; words: number } | null;
}

export function getMonthlyStats(year?: number, month?: number): MonthlyStats {
  const stats = loadStats();
  const now = new Date();
  const targetYear = year ?? now.getFullYear();
  const targetMonth = month ?? now.getMonth();

  const monthName = new Date(targetYear, targetMonth).toLocaleDateString('en-US', { month: 'long' });

  let totalWords = 0;
  let totalNotes = 0;
  let totalMinutes = 0;
  let daysActive = 0;
  let bestDay: { date: string; words: number } | null = null;

  // Get all days in the month
  const daysInMonth = new Date(targetYear, targetMonth + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(targetYear, targetMonth, day);
    const dateStr = date.toISOString().split('T')[0];
    const dayStat = stats[dateStr];

    if (dayStat) {
      totalWords += dayStat.wordsWritten;
      totalNotes += dayStat.notesEdited;
      totalMinutes += dayStat.minutesActive;

      if (dayStat.wordsWritten > 0) {
        daysActive++;

        if (!bestDay || dayStat.wordsWritten > bestDay.words) {
          bestDay = { date: dateStr, words: dayStat.wordsWritten };
        }
      }
    }
  }

  return {
    month: monthName,
    year: targetYear,
    totalWords,
    totalNotes,
    totalMinutes,
    daysActive,
    avgWordsPerDay: daysActive > 0 ? Math.round(totalWords / daysActive) : 0,
    bestDay,
  };
}

export function getRecentMonths(count: number = 3): MonthlyStats[] {
  const results: MonthlyStats[] = [];
  const now = new Date();

  for (let i = 0; i < count; i++) {
    const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
    results.push(getMonthlyStats(date.getFullYear(), date.getMonth()));
  }

  return results;
}
