import { useState } from "react";

const STREAK_DATE_KEY = "ppc-streak-date";
const STREAK_COUNT_KEY = "ppc-streak-count";
const TRAINED_DATE_KEY = "ppc-trained-date";

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function yesterdayISO(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

export function useDailyStreak() {
  const today = todayISO();

  const [streakCount, setStreakCount] = useState<number>(() => {
    const lastDate = localStorage.getItem(STREAK_DATE_KEY);
    const count = parseInt(localStorage.getItem(STREAK_COUNT_KEY) ?? "0", 10);
    if (!lastDate) return 0;
    if (lastDate === today) return count;
    if (lastDate === yesterdayISO()) return count;
    return 0; // streak broken
  });

  const [trainedToday, setTrainedToday] = useState<boolean>(
    () => localStorage.getItem(TRAINED_DATE_KEY) === today
  );

  const recordActivity = (): void => {
    const lastDate = localStorage.getItem(STREAK_DATE_KEY);
    if (lastDate === today) return;
    const prevCount = parseInt(localStorage.getItem(STREAK_COUNT_KEY) ?? "0", 10);
    const newCount = lastDate === yesterdayISO() ? prevCount + 1 : 1;
    localStorage.setItem(STREAK_DATE_KEY, today);
    localStorage.setItem(STREAK_COUNT_KEY, String(newCount));
    setStreakCount(newCount);
  };

  const recordTraining = (): void => {
    if (localStorage.getItem(TRAINED_DATE_KEY) !== today) {
      localStorage.setItem(TRAINED_DATE_KEY, today);
      setTrainedToday(true);
    }
    recordActivity();
  };

  return { streakCount, trainedToday, recordActivity, recordTraining };
}
