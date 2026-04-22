import { useState, useEffect, useCallback, useRef, type PointerEvent } from "react";
import {
  X, Dumbbell, Swords, Flame, Trophy,
  ChevronRight, Check, Zap, Timer,
} from "lucide-react";
import type { MapZone } from "@/data/mockData";
import { mockRivals, getPlayerById } from "@/data/mockData";
import { useGameProgress } from "@/context/GameProgressContext";
import {
  fetchTrainingTriviaSession,
  type ApiTrainingTriviaQuestion,
} from "@/lib/apiService";
import AnimatedPortrait from "./AnimatedPortrait";

interface ZoneExperienceProps {
  zone: MapZone;
  onClose: () => void;
}

type ZoneStep = "intro" | "activity" | "reward";
type TrainingTriviaMeta = {
  correctCount: number;
  streakBonus: number;
  maxStreak: number;
  totalQuestions: number;
};

/** Pressure Clock — fixed rewards applied in handleActivityComplete when present */
type PressureClockReward = {
  tierLabel: string;
  differenceMs: number;
  targetMs: number;
  elapsedMs: number;
  xp: number;
  confidence: number;
  fp: number;
};

/** Passing Triangle — fixed rewards (stadium zone) */
type PassingTriangleReward = {
  tierLabel: string;
  won: boolean;
  interceptElapsedSec: number | null;
  xp: number;
  form: number;
  confidence: number;
  eventPoints: number;
};

type ActivityCompleteMeta =
  | TrainingTriviaMeta
  | { pressureClock: PressureClockReward }
  | { passingTriangle: PassingTriangleReward };

function isPressureClockMeta(m: ActivityCompleteMeta | undefined): m is { pressureClock: PressureClockReward } {
  return Boolean(m && typeof m === "object" && "pressureClock" in m);
}

function isPassingTriangleMeta(m: ActivityCompleteMeta | undefined): m is { passingTriangle: PassingTriangleReward } {
  return Boolean(m && typeof m === "object" && "passingTriangle" in m);
}

function quadBezierPoint(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  t: number
) {
  const o = 1 - t;
  return {
    x: o * o * p0.x + 2 * o * t * p1.x + t * t * p2.x,
    y: o * o * p0.y + 2 * o * t * p1.y + t * t * p2.y,
  };
}

function clampBotOutsideCenter(
  x: number,
  y: number,
  cx: number,
  cy: number,
  rGuard: number,
  pad: number,
  field: number
) {
  let px = Math.max(pad, Math.min(field - pad, x));
  let py = Math.max(pad, Math.min(field - pad, y));
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy);
  if (d < rGuard + 0.01) {
    const a = Math.atan2(dy, dx);
    px = cx + Math.cos(a) * (rGuard + 1.5);
    py = cy + Math.sin(a) * (rGuard + 1.5);
  }
  return { x: px, y: py };
}

function separateBotTriad(
  bots: Array<{ x: number; y: number }>,
  minD: number,
  cx: number,
  cy: number,
  rGuard: number,
  pad: number,
  field: number
) {
  const out = bots.map((b) => ({ ...b }));
  for (let i = 0; i < out.length; i++) {
    for (let j = i + 1; j < out.length; j++) {
      const dx = out[j]!.x - out[i]!.x;
      const dy = out[j]!.y - out[i]!.y;
      const d = Math.hypot(dx, dy);
      if (d < minD && d > 1e-6) {
        const push = (minD - d) / 2 + 0.5;
        const nx = (dx / d) * push;
        const ny = (dy / d) * push;
        out[i] = { x: out[i]!.x - nx, y: out[i]!.y - ny };
        out[j] = { x: out[j]!.x + nx, y: out[j]!.y + ny };
      }
    }
  }
  return out.map((b) => clampBotOutsideCenter(b.x, b.y, cx, cy, rGuard, pad, field));
}

function clampToDisk(px: number, py: number, cx: number, cy: number, r: number) {
  const dx = px - cx;
  const dy = py - cy;
  const d = Math.hypot(dx, dy);
  if (d <= r || d < 1e-6) return { x: px, y: py };
  return { x: cx + (dx / d) * r, y: cy + (dy / d) * r };
}

function passingTriangleDifficulty(playedSec: number) {
  if (playedSec < 10) {
    return {
      passGapMin: 800,
      passGapMax: 1100,
      ballMin: 600,
      ballMax: 750,
      interceptR: 30,
      curveChance: 0.34,
      botSpeed: 46,
      botRetargetMin: 1800,
      botRetargetMax: 2600,
    };
  }
  if (playedSec < 20) {
    return {
      passGapMin: 1200,
      passGapMax: 1600,
      ballMin: 850,
      ballMax: 1000,
      interceptR: 37,
      curveChance: 0.28,
      botSpeed: 32,
      botRetargetMin: 2800,
      botRetargetMax: 3800,
    };
  }
  return {
    passGapMin: 1800,
    passGapMax: 2200,
    ballMin: 1100,
    ballMax: 1300,
    interceptR: 44,
    curveChance: 0.22,
    botSpeed: 22,
    botRetargetMin: 4000,
    botRetargetMax: 5200,
  };
}

function randRange(a: number, b: number) {
  return a + Math.random() * (b - a);
}

function passingTriangleTierForIntercept(t: number): PassingTriangleReward {
  if (t < 10) {
    return {
      tierLabel: "Clutch Interception",
      won: true,
      interceptElapsedSec: t,
      xp: 30,
      form: 8,
      confidence: 8,
      eventPoints: 15,
    };
  }
  if (t < 20) {
    return {
      tierLabel: "Sharp Read",
      won: true,
      interceptElapsedSec: t,
      xp: 22,
      form: 6,
      confidence: 5,
      eventPoints: 10,
    };
  }
  return {
    tierLabel: "Patient Steal",
    won: true,
    interceptElapsedSec: t,
    xp: 15,
    form: 4,
    confidence: 3,
    eventPoints: 8,
  };
}

function missedPassingTriangleReward(): PassingTriangleReward {
  return {
    tierLabel: "Missed Lane",
    won: false,
    interceptElapsedSec: null,
    xp: 5,
    form: 1,
    confidence: 0,
    eventPoints: 2,
  };
}

/* ── Zone identity config ──────────────────────────────────────────────── */
const zoneConfig: Record<
  MapZone["type"],
  {
    icon: typeof Dumbbell;
    emoji: string;
    purpose: string;
    cta: string;
    rewardLabel: string;
    attribute: "form" | "morale" | "fanBond" | "confidence";
    xp: number;
    attrGain: number;
    fpGain: number;
    gradient: string;
    bgAccent: string;
    ringColor: string;
  }
> = {
  training: {
    icon: Dumbbell,
    emoji: "🧠",
    purpose: "Answer soccer trivia fast to build tactical football knowledge.",
    cta: "Start Trivia Session",
    rewardLabel: "+Form",
    attribute: "form",
    xp: 26,
    attrGain: 4,
    fpGain: 1,
    gradient: "from-emerald-500 to-green-600",
    bgAccent: "bg-emerald-500/10",
    ringColor: "ring-emerald-500/30",
  },
  rival: {
    icon: Swords,
    emoji: "⚔️",
    purpose: "3-Move Tactical Duel: pick a rival, lock three moves, resolve fast.",
    cta: "Start Tactical Duel",
    rewardLabel: "+XP",
    attribute: "confidence",
    xp: 25,
    attrGain: 3,
    fpGain: 1,
    gradient: "from-red-500 to-rose-600",
    bgAccent: "bg-red-500/10",
    ringColor: "ring-red-500/30",
  },
  pressure: {
    icon: Flame,
    emoji: "🔥",
    purpose: "Pressure Clock: memorize the hidden countdown, then tap Stop when you think it hits zero.",
    cta: "Enter Pressure Clock",
    rewardLabel: "+Confidence",
    attribute: "confidence",
    xp: 30,
    attrGain: 5,
    fpGain: 2,
    gradient: "from-violet-500 to-purple-600",
    bgAccent: "bg-violet-500/10",
    ringColor: "ring-violet-500/30",
  },
  stadium: {
    icon: Trophy,
    emoji: "🏟️",
    purpose: "Passing Triangle: stay inside the circle, read the passes, and steal the ball before time runs out.",
    cta: "Start Passing Triangle",
    rewardLabel: "+Form · +Confidence",
    attribute: "morale",
    xp: 35,
    attrGain: 2,
    fpGain: 3,
    gradient: "from-yellow-400 to-amber-500",
    bgAccent: "bg-yellow-500/10",
    ringColor: "ring-yellow-500/30",
  },
  mission: {
    icon: Zap,
    emoji: "📸",
    purpose: "Complete camera scouting missions",
    cta: "Start Scouting",
    rewardLabel: "+XP",
    attribute: "form",
    xp: 25,
    attrGain: 1,
    fpGain: 2,
    gradient: "from-primary to-primary",
    bgAccent: "bg-primary/10",
    ringColor: "ring-primary/30",
  },
};

/* ── Fallback trivia bank (used when Gemini API is unavailable) ─────────── */
const FALLBACK_TRIVIA_QUESTIONS: ApiTrainingTriviaQuestion[] = [
  // EASY
  {
    id: "fb-01",
    question: "How many teams will compete in the 2026 FIFA World Cup?",
    options: ["48", "32", "40", "36"],
    answerIndex: 0,
    difficulty: "easy",
    explanation: "FIFA expanded the World Cup to 48 teams starting with the 2026 edition.",
  },
  {
    id: "fb-02",
    question: "Which trio of countries is hosting the 2026 FIFA World Cup?",
    options: ["USA, Canada & Mexico", "Brazil, Argentina & Chile", "Germany, France & Spain", "England, Italy & Portugal"],
    answerIndex: 0,
    difficulty: "easy",
    explanation: "The 2026 World Cup is co-hosted by the United States, Canada, and Mexico.",
  },
  {
    id: "fb-03",
    question: "Who won the 2022 FIFA World Cup in Qatar?",
    options: ["Argentina", "France", "Brazil", "Germany"],
    answerIndex: 0,
    difficulty: "easy",
    explanation: "Argentina beat France on penalties in the final in Lusail.",
  },
  {
    id: "fb-04",
    question: "How many players are on the field for each team in football?",
    options: ["11", "10", "12", "9"],
    answerIndex: 0,
    difficulty: "easy",
    explanation: "Each team fields 11 players, including the goalkeeper.",
  },
  {
    id: "fb-05",
    question: "What colour card means a player is sent off in football?",
    options: ["Red", "Yellow", "Blue", "Orange"],
    answerIndex: 0,
    difficulty: "easy",
    explanation: "A red card results in immediate dismissal from the match.",
  },
  {
    id: "fb-06",
    question: "Which country has won the most FIFA World Cup titles?",
    options: ["Brazil", "Germany", "Italy", "Argentina"],
    answerIndex: 0,
    difficulty: "easy",
    explanation: "Brazil has won five World Cups: 1958, 1962, 1970, 1994, and 2002.",
  },
  {
    id: "fb-07",
    question: "What does a 'hat-trick' mean in football?",
    options: ["Three goals by one player in a single match", "Three yellow cards in a tournament", "Winning three matches in a row", "Scoring from three different positions"],
    answerIndex: 0,
    difficulty: "easy",
    explanation: "A hat-trick is when a single player scores three goals in one game.",
  },
  {
    id: "fb-08",
    question: "How long is a standard football match (excluding extra time)?",
    options: ["90 minutes", "80 minutes", "100 minutes", "120 minutes"],
    answerIndex: 0,
    difficulty: "easy",
    explanation: "A standard match consists of two 45-minute halves.",
  },
  {
    id: "fb-09",
    question: "What shape is a standard football (soccer ball)?",
    options: ["Spherical", "Oval", "Cylindrical", "Hexagonal"],
    answerIndex: 0,
    difficulty: "easy",
    explanation: "A football is a sphere, typically made with 32 panels.",
  },
  {
    id: "fb-10",
    question: "In which city will the 2026 World Cup final be held?",
    options: ["New York / New Jersey", "Los Angeles", "Dallas", "Mexico City"],
    answerIndex: 0,
    difficulty: "easy",
    explanation: "MetLife Stadium in East Rutherford, NJ (serving the New York area) is slated to host the final.",
  },
  // MEDIUM
  {
    id: "fb-11",
    question: "Which player has scored the most goals in FIFA World Cup history?",
    options: ["Miroslav Klose", "Ronaldo (Brazil)", "Gerd Müller", "Just Fontaine"],
    answerIndex: 0,
    difficulty: "medium",
    explanation: "Miroslav Klose scored 16 goals across four World Cups (2002–2014).",
  },
  {
    id: "fb-12",
    question: "Who scored the famous 'Hand of God' goal at the 1986 World Cup?",
    options: ["Diego Maradona", "Pelé", "Ronaldo", "Zinedine Zidane"],
    answerIndex: 0,
    difficulty: "medium",
    explanation: "Maradona scored with his hand against England in the 1986 quarter-final.",
  },
  {
    id: "fb-13",
    question: "What is the maximum distance from which a penalty kick is taken?",
    options: ["12 yards (11 m)", "10 yards (9 m)", "15 yards (13.7 m)", "18 yards (16.5 m)"],
    answerIndex: 0,
    difficulty: "medium",
    explanation: "The penalty spot is 12 yards (11 metres) from the goal line.",
  },
  {
    id: "fb-14",
    question: "Which nation won the very first FIFA World Cup in 1930?",
    options: ["Uruguay", "Argentina", "Brazil", "Italy"],
    answerIndex: 0,
    difficulty: "medium",
    explanation: "Uruguay hosted and won the inaugural World Cup, beating Argentina 4–2 in the final.",
  },
  {
    id: "fb-15",
    question: "How many goals did France's Kylian Mbappé score at the 2022 World Cup final?",
    options: ["3", "2", "1", "4"],
    answerIndex: 0,
    difficulty: "medium",
    explanation: "Mbappé scored a hat-trick in the final but France lost on penalties.",
  },
  {
    id: "fb-16",
    question: "Which goalkeeper made the famous 'saves' to help Argentina win the 2022 World Cup final shoot-out?",
    options: ["Emiliano Martínez", "David de Gea", "Hugo Lloris", "Alisson Becker"],
    answerIndex: 0,
    difficulty: "medium",
    explanation: "Emiliano 'Dibu' Martínez saved two penalties in the shoot-out against France.",
  },
  {
    id: "fb-17",
    question: "What is the term for when a team wins without conceding any goals throughout a tournament?",
    options: ["Clean sheet run", "Whitewash", "Golden glove run", "Perfect defence"],
    answerIndex: 0,
    difficulty: "medium",
    explanation: "Keeping a 'clean sheet' in every game is considered a 'clean sheet run'.",
  },
  {
    id: "fb-18",
    question: "Which country won the 2018 FIFA World Cup in Russia?",
    options: ["France", "Croatia", "Belgium", "England"],
    answerIndex: 0,
    difficulty: "medium",
    explanation: "France beat Croatia 4–2 in the final held at Luzhniki Stadium, Moscow.",
  },
  {
    id: "fb-19",
    question: "Which player won the Golden Ball (best player) at the 2022 World Cup?",
    options: ["Lionel Messi", "Kylian Mbappé", "Luka Modrić", "Enzo Fernández"],
    answerIndex: 0,
    difficulty: "medium",
    explanation: "Lionel Messi won the Golden Ball for the second time, having also won it in 2014.",
  },
  {
    id: "fb-20",
    question: "How many World Cup titles has Germany (including West Germany) won?",
    options: ["4", "3", "5", "2"],
    answerIndex: 0,
    difficulty: "medium",
    explanation: "Germany won in 1954, 1974, 1990, and 2014.",
  },
  // HARD
  {
    id: "fb-21",
    question: "Just Fontaine set the record for most goals in a single World Cup. How many did he score in 1958?",
    options: ["13", "11", "9", "15"],
    answerIndex: 0,
    difficulty: "hard",
    explanation: "Just Fontaine scored 13 goals for France at the 1958 World Cup in Sweden — a record that still stands.",
  },
  {
    id: "fb-22",
    question: "Which stadium will host the most matches at the 2026 World Cup?",
    options: ["MetLife Stadium (New York/NJ)", "AT&T Stadium (Dallas)", "SoFi Stadium (LA)", "Azteca Stadium (Mexico City)"],
    answerIndex: 0,
    difficulty: "hard",
    explanation: "MetLife Stadium is the largest venue selected and is set to host the final plus the most group and knockout games.",
  },
  {
    id: "fb-23",
    question: "In what year did FIFA introduce goal-line technology at the World Cup for the first time?",
    options: ["2014", "2010", "2018", "2006"],
    answerIndex: 0,
    difficulty: "hard",
    explanation: "Goal-line technology (GoalControl-4D) was used for the first time at the 2014 World Cup in Brazil.",
  },
  {
    id: "fb-24",
    question: "Which player scored the fastest goal in World Cup history (11 seconds)?",
    options: ["Hakan Şükür", "Robbie Rensenbrink", "Bernard Lacombe", "Emile Veinante"],
    answerIndex: 0,
    difficulty: "hard",
    explanation: "Hakan Şükür of Turkey scored after just 11 seconds vs South Korea in the 2002 third-place play-off.",
  },
  {
    id: "fb-25",
    question: "What was the highest-scoring World Cup match in history (combined goals)?",
    options: ["Austria 7–5 Switzerland (1954)", "Hungary 10–1 El Salvador (1982)", "Brazil 5–2 Sweden (1958)", "West Germany 8–0 Mexico (1978)"],
    answerIndex: 0,
    difficulty: "hard",
    explanation: "Austria beat Switzerland 7–5 in 1954, totalling 12 goals — the most in a single World Cup match.",
  },
  {
    id: "fb-26",
    question: "VAR (Video Assistant Referee) was first used at which World Cup?",
    options: ["2018 (Russia)", "2014 (Brazil)", "2022 (Qatar)", "2010 (South Africa)"],
    answerIndex: 0,
    difficulty: "hard",
    explanation: "VAR made its World Cup debut at Russia 2018, becoming a turning point in officiating.",
  },
  {
    id: "fb-27",
    question: "Which country has appeared in the most World Cup finals without winning?",
    options: ["Netherlands", "Czechoslovakia", "Hungary", "Sweden"],
    answerIndex: 0,
    difficulty: "hard",
    explanation: "The Netherlands have played in three World Cup finals (1974, 1978, 2010) and lost all of them.",
  },
  {
    id: "fb-28",
    question: "How many African nations will qualify for the 2026 FIFA World Cup?",
    options: ["9", "5", "6", "8"],
    answerIndex: 0,
    difficulty: "hard",
    explanation: "With 48 teams, Africa receives 9 guaranteed slots (up from 5 in previous editions).",
  },
  {
    id: "fb-29",
    question: "Which team suffered the biggest ever World Cup defeat, losing 8–0 in 2022?",
    options: ["El Salvador vs Hungary (1982)", "Kuwait vs Czechoslovakia (1982)", "Zaire vs Yugoslavia (1974)", "Bolivia vs Uruguay (1950)"],
    answerIndex: 0,
    difficulty: "hard",
    explanation: "El Salvador lost 10–1 to Hungary in 1982 — the largest single-match defeat in World Cup history.",
  },
  {
    id: "fb-30",
    question: "What is the name of the official match ball used at the 2022 FIFA World Cup?",
    options: ["Al Rihla", "Brazuca", "Jabulani", "Telstar 18"],
    answerIndex: 0,
    difficulty: "hard",
    explanation: "'Al Rihla' means 'the journey' in Arabic and was the official ball of Qatar 2022.",
  },
];

/* ── Training Ground: Soccer Trivia Blitz ─────────────────────────────── */
function TrainingActivity({
  onComplete,
}: {
  onComplete: (score: number, meta?: TrainingTriviaMeta) => void;
}) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [questions, setQuestions] = useState<ApiTrainingTriviaQuestion[]>([]);
  const [questionTimeLimit, setQuestionTimeLimit] = useState(5);
  const [passScore, setPassScore] = useState(6);
  const [index, setIndex] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [correctCount, setCorrectCount] = useState(0);
  const [streak, setStreak] = useState(0);
  const [maxStreak, setMaxStreak] = useState(0);
  const [streakBonus, setStreakBonus] = useState(0);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [locked, setLocked] = useState(false);
  const [showTimeout, setShowTimeout] = useState(false);

  const orderedQuestions = useRef<ApiTrainingTriviaQuestion[]>([]);
  const current = orderedQuestions.current[index] ?? null;

  const normalizeDifficulty = (difficulty: ApiTrainingTriviaQuestion["difficulty"]) => {
    if (difficulty === "easy") return 0;
    if (difficulty === "medium") return 1;
    return 2;
  };

  const shuffleGroup = (arr: ApiTrainingTriviaQuestion[], salt: number) => {
    const out = [...arr];
    for (let i = out.length - 1; i > 0; i -= 1) {
      const j = Math.floor(((Math.sin((i + 1) * 97.13 + salt) + 1) / 2) * (i + 1));
      const t = out[i]!;
      out[i] = out[j]!;
      out[j] = t;
    }
    return out;
  };

  const advance = useCallback(() => {
    setTimeout(() => {
      setSelectedIndex(null);
      setShowTimeout(false);
      setLocked(false);
      setIndex((prev) => {
        const next = prev + 1;
        if (next >= orderedQuestions.current.length) {
          onComplete(correctCount, {
            correctCount,
            streakBonus,
            maxStreak,
            totalQuestions: orderedQuestions.current.length,
          });
          return prev;
        }
        return next;
      });
    }, 450);
  }, [correctCount, streakBonus, maxStreak, onComplete]);

  useEffect(() => {
    let cancelled = false;
    const loadSession = async () => {
      setLoading(true);
      setError(null);
      try {
        // Race against a 5-second timeout so the fallback triggers even if the
        // API hangs and never rejects.
        const result = await Promise.race([
          fetchTrainingTriviaSession(10, `${Date.now()}-${Math.random()}`),
          new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error("trivia-timeout")), 5000)
          ),
        ]);
        if (cancelled) return;
        if (!result.data.length) {
          const fallback = FALLBACK_TRIVIA_QUESTIONS.sort(() => Math.random() - 0.5).slice(0, 10);
          const easy = fallback.filter((q) => q.difficulty === "easy");
          const medium = fallback.filter((q) => q.difficulty === "medium");
          const hard = fallback.filter((q) => q.difficulty === "hard");
          orderedQuestions.current = [...easy, ...medium, ...hard];
          if (!orderedQuestions.current.length) orderedQuestions.current = fallback;
          setQuestionTimeLimit(8);
          setPassScore(6);
          setTimeLeft(8);
          setLoading(false);
          return;
        }
        setQuestions(result.data);
        const easy = result.data.filter((q) => q.difficulty === "easy");
        const medium = result.data.filter((q) => q.difficulty === "medium");
        const hard = result.data.filter((q) => q.difficulty === "hard");
        orderedQuestions.current = [
          ...shuffleGroup(easy, 1),
          ...shuffleGroup(medium, 2),
          ...shuffleGroup(hard, 3),
        ];
        if (!orderedQuestions.current.length) {
          orderedQuestions.current = [...result.data].sort(
            (a, b) => normalizeDifficulty(a.difficulty) - normalizeDifficulty(b.difficulty)
          );
        }
        setQuestionTimeLimit(result.config.questionTimeLimitSec);
        setPassScore(result.config.passScore);
        setTimeLeft(result.config.questionTimeLimitSec);
      } catch {
        if (cancelled) return;
        const fallback = FALLBACK_TRIVIA_QUESTIONS.sort(() => Math.random() - 0.5).slice(0, 10);
        const easy = fallback.filter((q) => q.difficulty === "easy");
        const medium = fallback.filter((q) => q.difficulty === "medium");
        const hard = fallback.filter((q) => q.difficulty === "hard");
        orderedQuestions.current = [...easy, ...medium, ...hard];
        if (!orderedQuestions.current.length) orderedQuestions.current = fallback;
        setQuestionTimeLimit(8);
        setPassScore(6);
        setTimeLeft(8);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void loadSession();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!current || locked || loading) return;
    setTimeLeft(questionTimeLimit);
    const tick = window.setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          window.clearInterval(tick);
          setLocked(true);
          setShowTimeout(true);
          advance();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [current, locked, questionTimeLimit, loading, advance]);

  const answer = (choiceIdx: number) => {
    if (!current || locked) return;
    setSelectedIndex(choiceIdx);
    setLocked(true);
    const correct = choiceIdx === current.answerIndex;
    if (correct) {
      setCorrectCount((s) => s + 1);
      setStreak((prev) => {
        const next = prev + 1;
        setMaxStreak((m) => Math.max(m, next));
        if (next > 0 && next % 3 === 0) {
          setStreakBonus((b) => b + 1);
        }
        return next;
      });
    } else {
      setStreak(0);
    }
    advance();
  };

  if (loading) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs text-muted-foreground animate-pulse">Loading soccer trivia session…</p>
      </div>
    );
  }

  if (error || !current) {
    return (
      <div className="py-6 text-center">
        <p className="text-xs text-destructive">{error ?? "Trivia unavailable."}</p>
        <button
          type="button"
          onClick={() => onComplete(0)}
          className="mt-3 px-4 py-2 rounded-xl glass-card-strong text-xs font-bold"
        >
          Skip for now
        </button>
      </div>
    );
  }

  const pct = Math.max(0, Math.min(100, (timeLeft / questionTimeLimit) * 100));
  const progressDots = questions.length;

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs font-black text-foreground">Soccer Trivia Blitz</p>
        <div className="flex items-center gap-1">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          <span className={`text-xs font-black ${timeLeft <= 2 ? "text-destructive" : "text-foreground"}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      <div className="h-2 bg-muted rounded-full overflow-hidden mb-3">
        <div
          className={`h-full transition-all duration-200 ${timeLeft <= 2 ? "bg-destructive" : "bg-emerald-500"}`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <p className="text-[11px] font-bold text-foreground leading-relaxed mb-3">{current.question}</p>

      <div className="grid gap-2">
        {current.options.map((opt, i) => {
          const isCorrect = i === current.answerIndex;
          const isChosen = selectedIndex === i;
          const stateClass =
            locked && isCorrect
              ? "border-emerald-500/60 bg-emerald-500/10"
              : locked && isChosen && !isCorrect
                ? "border-destructive/50 bg-destructive/10"
                : "border-border/30 bg-background/40 hover:bg-muted/40";
          return (
            <button
              key={`${current.id}-${i}`}
              type="button"
              disabled={locked}
              onClick={() => answer(i)}
              className={`w-full p-2.5 rounded-xl text-left border transition-all text-xs ${stateClass}`}
            >
              {opt}
            </button>
          );
        })}
      </div>

      <div className="flex items-center justify-between mt-3">
        <div className="flex gap-1.5">
          {Array.from({ length: progressDots }).map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < correctCount ? "bg-emerald-500" : i < index ? "bg-destructive/40" : "bg-muted"
            }`} />
          ))}
        </div>
        <p className="text-[10px] font-bold text-muted-foreground">
          Q {Math.min(index + 1, orderedQuestions.current.length)}/{orderedQuestions.current.length} · Pass at {passScore}
        </p>
      </div>
      <div className="flex items-center justify-between mt-2 text-[10px]">
        <p className={`${streak >= 2 ? "text-primary font-bold" : "text-muted-foreground"}`}>
          Streak: {streak}
        </p>
        <p className="text-amber-400 font-bold">Bonus +{streakBonus}</p>
      </div>

      {showTimeout && <p className="text-[10px] text-destructive mt-2">Time up. Next question…</p>}
    </div>
  );
}

/* ── Rival Pitch: Mock-local PvP Penalty Duel ─────────────────────────── */
type PvPStatus = "available" | "pending_challenge" | "dueling" | "cooldown" | "offline";
type PvPTab = "local" | "global" | "recent";
type PvPGoalZone = "tl" | "tc" | "tr" | "bl" | "bc" | "br";
type PvPShotType = "high" | "curve" | "speed";
type PvPOutcome = "goal" | "save" | "missed" | "woodwork" | "deflected" | "close-miss";
type DuelTurnPhase = "pick" | "reveal";

type PvPChallenger = {
  id: string;
  userName: string;
  level: number;
  playerId: string;
  wins: number;
  losses: number;
  status: PvPStatus;
  localSessionId: string;
  region: string;
  cooldownUntilMs?: number;
};

type TurnDecision = {
  zone: PvPGoalZone;
  powerPct: number;
  shotType: PvPShotType;
  auto: boolean;
};

type PvPTurn = {
  round: number;
  sudden: boolean;
  kicker: "you" | "them";
  keeper: "you" | "them";
};

type RecentPvPRow = {
  id: string;
  challenger: string;
  opponent: string;
  score: string;
  result: string;
  atMs: number;
};

const PVP_BALL_POS: Record<PvPGoalZone | "miss-left" | "miss-right" | "miss-high", { left: string; top: string }> = {
  tl: { left: "17%", top: "20%" },
  tc: { left: "50%", top: "15%" },
  tr: { left: "83%", top: "20%" },
  bl: { left: "17%", top: "58%" },
  bc: { left: "50%", top: "54%" },
  br: { left: "83%", top: "58%" },
  "miss-left": { left: "-7%", top: "45%" },
  "miss-right": { left: "107%", top: "45%" },
  "miss-high": { left: "50%", top: "-10%" },
};

function zoneToDir(z: PvPGoalZone): Direction {
  if (z.endsWith("l")) return "left";
  if (z.endsWith("r")) return "right";
  return "center";
}

function sameSideZone(a: PvPGoalZone, b: PvPGoalZone) {
  return zoneToDir(a) === zoneToDir(b);
}

function sameHeightZone(a: PvPGoalZone, b: PvPGoalZone) {
  return (a.startsWith("t") && b.startsWith("t")) || (a.startsWith("b") && b.startsWith("b"));
}

function randomPvPZone(): PvPGoalZone {
  const z: PvPGoalZone[] = ["tl", "tc", "tr", "bl", "bc", "br"];
  return z[Math.floor(Math.random() * z.length)]!;
}

function randomShotType(): PvPShotType {
  const r = Math.random();
  if (r < 0.34) return "curve";
  if (r < 0.67) return "speed";
  return "high";
}

function powerBandFromPct(p: number) {
  if (p < 34) return "low" as const;
  if (p <= 68) return "mid" as const;
  return "high" as const;
}

function resolvePvPTurn(
  kicker: TurnDecision,
  keeper: TurnDecision,
  kickerOverall: number,
  keeperOverall: number
) {
  const powerBand = powerBandFromPct(kicker.powerPct);
  let saveChance =
    keeper.zone === kicker.zone
      ? 0.68
      : sameSideZone(keeper.zone, kicker.zone)
        ? 0.42
        : sameHeightZone(keeper.zone, kicker.zone)
          ? 0.3
          : 0.14;
  if (keeper.shotType === kicker.shotType) saveChance += 0.12;
  else saveChance -= 0.08;
  if (kicker.shotType === "curve" && keeper.shotType !== "curve") saveChance -= 0.06;
  if (kicker.shotType === "speed") saveChance += keeper.zone === kicker.zone ? 0.06 : -0.07;
  if (powerBand === "mid") saveChance -= 0.05;
  if (powerBand === "low") saveChance += 0.03;
  if (powerBand === "high") saveChance -= 0.03;
  saveChance += Math.max(-0.04, Math.min(0.05, (keeperOverall - kickerOverall) * 0.002));
  saveChance = Math.max(0.05, Math.min(0.9, saveChance));

  let missChance = 0.03;
  if (powerBand === "high") missChance += kicker.zone.startsWith("t") ? 0.16 : 0.09;
  if (powerBand === "low") missChance -= 0.01;
  missChance = Math.max(0.01, missChance);

  const r = Math.random();
  let outcome: PvPOutcome;
  let ballEnd: keyof typeof PVP_BALL_POS = kicker.zone;
  if (r < missChance) {
    if (Math.random() < (powerBand === "high" ? 0.12 : 0.04)) {
      outcome = "woodwork";
      ballEnd = kicker.zone === "tl" || kicker.zone === "bl" ? "tl" : kicker.zone === "tr" || kicker.zone === "br" ? "tr" : "tc";
    } else {
      outcome = "missed";
      ballEnd = kicker.zone === "tl" || kicker.zone === "bl" ? "miss-left" : kicker.zone === "tr" || kicker.zone === "br" ? "miss-right" : "miss-high";
    }
  } else if (r < missChance + saveChance) {
    outcome = kicker.shotType === "speed" || keeper.zone !== kicker.zone ? "deflected" : "save";
    ballEnd = keeper.zone;
  } else {
    outcome = "goal";
    ballEnd = kicker.zone;
  }

  return {
    outcome,
    ballEnd,
    gloveDir: zoneToDir(keeper.zone),
    goalScored: outcome === "goal",
    explain:
      outcome === "goal"
        ? "Clean finish."
        : outcome === "save"
          ? "Keeper read it perfectly."
          : outcome === "deflected"
            ? "Touch on the shot."
            : outcome === "woodwork"
              ? "Clipped the frame."
              : "Pulled wide/over.",
  };
}

function RivalPitchActivity({ onComplete }: { onComplete: (score: number) => void }) {
  const { activePlayer, playersById, ownedPlayersById } = useGameProgress();
  const hasOwned = Object.keys(ownedPlayersById).length > 0;
  const localSessionId = "local-session-alpha";
  const [tab, setTab] = useState<PvPTab>("local");
  const [challengers, setChallengers] = useState<PvPChallenger[]>(() =>
    [
      {
        id: "pvp-good-bunny",
        userName: "Good Bunny",
        level: 9,
        playerId: "2",
        wins: 6,
        losses: 3,
        status: "available" as const,
        localSessionId: "local-session-alpha",
        region: "New Haven",
      },
      ...mockRivals.map((r, i) => ({
        id: r.id,
        userName: r.name,
        level: r.level,
        playerId: r.signaturePlayerId,
        wins: 8 + i * 2,
        losses: 4 + i,
        status: i === 2 ? "cooldown" : "available",
        localSessionId: i === 1 ? "local-session-beta" : "local-session-alpha",
        region: "New Haven",
        cooldownUntilMs: i === 2 ? Date.now() + 18000 : undefined,
      })),
    ]
  );
  const [recentRows, setRecentRows] = useState<RecentPvPRow[]>([
    { id: "rp1", challenger: "Daniel", opponent: "Alex", score: "3-2", result: "Daniel beat Alex", atMs: Date.now() - 2 * 60 * 1000 },
    { id: "rp2", challenger: "Chris", opponent: "Maya", score: "1-1", result: "Chris drew with Maya", atMs: Date.now() - 5 * 60 * 1000 },
  ]);
  const [pendingChallengeId, setPendingChallengeId] = useState<string | null>(null);
  const [incomingPrompt, setIncomingPrompt] = useState<string | null>(null);
  const [requestExpiresAt, setRequestExpiresAt] = useState<number | null>(null);

  const [duelTargetId, setDuelTargetId] = useState<string | null>(null);
  const [duelTurnIndex, setDuelTurnIndex] = useState(0);
  const [turnPhase, setTurnPhase] = useState<DuelTurnPhase>("pick");
  const [turnTimer, setTurnTimer] = useState(8);
  const [youScore, setYouScore] = useState(0);
  const [themScore, setThemScore] = useState(0);
  const [yourDecision, setYourDecision] = useState<TurnDecision | null>(null);
  const [theirDecision, setTheirDecision] = useState<TurnDecision | null>(null);
  const [lockedYou, setLockedYou] = useState(false);
  const [lockedThem, setLockedThem] = useState(false);
  const [draftZone, setDraftZone] = useState<PvPGoalZone | null>(null);
  const [draftShotType, setDraftShotType] = useState<PvPShotType>("speed");
  const [powerPct, setPowerPct] = useState(20);
  const [ballAt, setBallAt] = useState<keyof typeof PVP_BALL_POS | null>(null);
  const [gloveDir, setGloveDir] = useState<Direction | null>(null);
  const [lastOutcome, setLastOutcome] = useState<PvPOutcome | null>(null);
  const [lastExplain, setLastExplain] = useState("");
  const [matchDone, setMatchDone] = useState(false);
  const powerDirRef = useRef(1);

  useEffect(() => {
    const id = window.setInterval(() => {
      setChallengers((prev) =>
        prev.map((c) => {
          if (c.status !== "cooldown" || !c.cooldownUntilMs) return c;
          if (Date.now() >= c.cooldownUntilMs) return { ...c, status: "available", cooldownUntilMs: undefined };
          return c;
        })
      );
      if (requestExpiresAt && Date.now() >= requestExpiresAt) {
        setPendingChallengeId(null);
        setIncomingPrompt(null);
        setRequestExpiresAt(null);
        setChallengers((prev) => prev.map((c) => (c.status === "pending_challenge" ? { ...c, status: "available" } : c)));
      }
    }, 500);
    return () => window.clearInterval(id);
  }, [requestExpiresAt]);

  const duelTurns: PvPTurn[] = [
    { round: 1, sudden: false, kicker: "you", keeper: "them" },
    { round: 1, sudden: false, kicker: "them", keeper: "you" },
    { round: 2, sudden: false, kicker: "you", keeper: "them" },
    { round: 2, sudden: false, kicker: "them", keeper: "you" },
    { round: 3, sudden: false, kicker: "you", keeper: "them" },
    { round: 3, sudden: false, kicker: "them", keeper: "you" },
    { round: 4, sudden: true, kicker: "you", keeper: "them" },
    { round: 4, sudden: true, kicker: "them", keeper: "you" },
    { round: 5, sudden: true, kicker: "you", keeper: "them" },
    { round: 5, sudden: true, kicker: "them", keeper: "you" },
    { round: 6, sudden: true, kicker: "you", keeper: "them" },
    { round: 6, sudden: true, kicker: "them", keeper: "you" },
  ];
  const curTurn = duelTurns[Math.min(duelTurnIndex, duelTurns.length - 1)]!;
  const isYourKick = curTurn.kicker === "you";

  useEffect(() => {
    if (!duelTargetId || matchDone) return;
    setTurnTimer(8);
    setLockedYou(false);
    setLockedThem(false);
    setYourDecision(null);
    setTheirDecision(null);
    setDraftZone(null);
    setDraftShotType("speed");
    setTurnPhase("pick");
    setBallAt(null);
    setGloveDir(null);
    setLastOutcome(null);
    setLastExplain("");
  }, [duelTargetId, duelTurnIndex, matchDone]);

  useEffect(() => {
    if (!duelTargetId || matchDone) return;
    if (turnPhase !== "pick") return;
    const id = window.setInterval(() => {
      setTurnTimer((prev) => {
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [duelTargetId, turnPhase, matchDone]);

  useEffect(() => {
    if (!duelTargetId || turnPhase !== "pick" || matchDone || lockedThem) return;
    const aiLockDelay = 900 + Math.random() * 1500;
    const t = window.setTimeout(() => {
      const ai: TurnDecision = {
        zone: randomPvPZone(),
        powerPct: 35 + Math.random() * 55,
        shotType: randomShotType(),
        auto: false,
      };
      setTheirDecision(ai);
      setLockedThem(true);
    }, aiLockDelay);
    return () => window.clearTimeout(t);
  }, [duelTargetId, turnPhase, matchDone, lockedThem, duelTurnIndex]);

  useEffect(() => {
    if (!duelTargetId || turnPhase !== "pick" || matchDone) return;
    if (turnTimer > 0) return;
    if (!lockedYou) {
      const autoMe: TurnDecision = { zone: randomPvPZone(), powerPct: 48, shotType: randomShotType(), auto: true };
      setYourDecision(autoMe);
      setLockedYou(true);
    }
    if (!lockedThem) {
      const autoThem: TurnDecision = { zone: randomPvPZone(), powerPct: 48, shotType: randomShotType(), auto: true };
      setTheirDecision(autoThem);
      setLockedThem(true);
    }
  }, [duelTargetId, turnPhase, matchDone, turnTimer, lockedYou, lockedThem]);

  useEffect(() => {
    if (!duelTargetId || turnPhase !== "pick" || matchDone) return;
    if (!lockedYou || !lockedThem) return;
    const k = curTurn.kicker === "you" ? yourDecision : theirDecision;
    const g = curTurn.keeper === "you" ? yourDecision : theirDecision;
    if (!k || !g) return;

    const resolved = resolvePvPTurn(
      k,
      g,
      curTurn.kicker === "you" ? activePlayer.stats.overall : 74,
      curTurn.keeper === "you" ? activePlayer.stats.overall : 74
    );
    const nextYou = youScore + (resolved.goalScored && curTurn.kicker === "you" ? 1 : 0);
    const nextThem = themScore + (resolved.goalScored && curTurn.kicker === "them" ? 1 : 0);
    setTurnPhase("reveal");
    setBallAt(resolved.ballEnd);
    setGloveDir(resolved.gloveDir);
    setLastOutcome(resolved.outcome);
    setLastExplain(resolved.explain);
    setYouScore(nextYou);
    setThemScore(nextThem);

    const nextT = window.setTimeout(() => {
      const nextIdx = duelTurnIndex + 1;
      const afterRegulation = nextIdx >= 6;
      if (afterRegulation && (nextIdx >= 12 || (nextIdx % 2 === 0 && nextYou !== nextThem))) {
        setMatchDone(true);
        const targetName = challengers.find((c) => c.id === duelTargetId)?.userName ?? "Rival";
        const resultText = nextYou > nextThem
          ? `${activePlayer.name} beat ${targetName}`
          : nextYou < nextThem
            ? `${targetName} beat ${activePlayer.name}`
            : `${activePlayer.name} drew with ${targetName}`;
        setRecentRows((prev) => [
          { id: `r-${Date.now()}`, challenger: activePlayer.name, opponent: targetName, score: `${nextYou}-${nextThem}`, result: resultText, atMs: Date.now() },
          ...prev.slice(0, 5),
        ]);
        setChallengers((prev) =>
          prev.map((c) =>
            c.id === duelTargetId || c.status === "dueling"
              ? { ...c, status: "cooldown", cooldownUntilMs: Date.now() + 20000 }
              : c
          )
        );
        const outcomeScore = nextYou > nextThem ? 6 : nextYou === nextThem ? 4 : 2;
        onComplete(outcomeScore);
        return;
      }
      setDuelTurnIndex(nextIdx);
    }, 1400);
    return () => window.clearTimeout(nextT);
  }, [
    duelTargetId,
    turnPhase,
    matchDone,
    lockedYou,
    lockedThem,
    yourDecision,
    theirDecision,
    curTurn,
    duelTurnIndex,
    activePlayer.stats.overall,
    activePlayer.name,
    youScore,
    themScore,
    challengers,
    onComplete,
  ]);

  useEffect(() => {
    if (!duelTargetId || matchDone || turnPhase !== "pick") return;
    if (!(isYourKick && !lockedYou)) return;
    setPowerPct(20);
    const id = window.setInterval(() => {
      setPowerPct((prev) => {
        const next = prev + powerDirRef.current * 4;
        if (next >= 100) {
          powerDirRef.current = -1;
          return 100;
        }
        if (next <= 0) {
          powerDirRef.current = 1;
          return 0;
        }
        return next;
      });
    }, 40);
    return () => window.clearInterval(id);
  }, [duelTargetId, matchDone, turnPhase, isYourKick, lockedYou]);

  const issueChallenge = (id: string) => {
    if (!hasOwned || duelTargetId || pendingChallengeId) return;
    setPendingChallengeId(id);
    setIncomingPrompt(id);
    setRequestExpiresAt(Date.now() + 15000);
    setChallengers((prev) => prev.map((c) => (c.id === id ? { ...c, status: "pending_challenge" } : c)));
  };

  const acceptChallenge = () => {
    if (!incomingPrompt) return;
    setRequestExpiresAt(null);
    setPendingChallengeId(null);
    setIncomingPrompt(null);
    setDuelTargetId(incomingPrompt);
    setDuelTurnIndex(0);
    setMatchDone(false);
    setYouScore(0);
    setThemScore(0);
    setChallengers((prev) => prev.map((c) => (c.id === incomingPrompt ? { ...c, status: "dueling" } : c)));
  };

  const declineChallenge = () => {
    if (!incomingPrompt) return;
    const id = incomingPrompt;
    setIncomingPrompt(null);
    setPendingChallengeId(null);
    setRequestExpiresAt(null);
    setChallengers((prev) => prev.map((c) => (c.id === id ? { ...c, status: "available" } : c)));
  };

  const lockMyChoice = (zone: PvPGoalZone, shotType: PvPShotType) => {
    if (!duelTargetId || turnPhase !== "pick" || lockedYou) return;
    const decision: TurnDecision = {
      zone,
      powerPct: isYourKick ? powerPct : 50,
      shotType,
      auto: false,
    };
    setYourDecision(decision);
    setLockedYou(true);
  };

  const localFiltered = challengers.filter((c) => c.localSessionId === localSessionId && c.region === "New Haven");
  const target = duelTargetId ? challengers.find((c) => c.id === duelTargetId) : null;

  if (duelTargetId && target) {
    const theirPlayer = playersById[target.playerId] ?? getPlayerById(target.playerId);
    const canPickZone = turnPhase === "pick" && !lockedYou;
    const yourIsKicker = curTurn.kicker === "you";
    const selectPrompt = yourIsKicker ? "Pick shot zone and lock power" : "Pick defend zone + shot read";
    const canLockNow = yourIsKicker ? Boolean(draftZone) : Boolean(draftZone && draftShotType);
    return (
      <div className="py-3 space-y-3">
        <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-black text-foreground">PvP Penalty Duel</p>
            <p className="text-[10px] font-black text-red-300">
              {curTurn.sudden ? `Sudden Death ${Math.max(1, Math.floor((duelTurnIndex - 6) / 2) + 1)}` : `Round ${curTurn.round}`}
            </p>
          </div>
          <div className="flex items-center justify-between text-[10px]">
            <span className="text-foreground font-bold">{activePlayer.name}</span>
            <span className="text-muted-foreground">Score</span>
            <span className="text-foreground font-bold">{target.userName}</span>
          </div>
          <div className="text-center text-lg font-black text-foreground mt-0.5">{youScore} - {themScore}</div>
          <div className="flex items-center justify-between mt-2 text-[10px]">
            <span className={`${curTurn.kicker === "you" ? "text-primary font-black" : "text-muted-foreground"}`}>
              You: {curTurn.kicker === "you" ? "Kicker" : "Goalkeeper"}
            </span>
            <span className="text-amber-300 font-black">{turnPhase === "pick" ? `${turnTimer}s` : "Resolving…"}</span>
            <span className={`${curTurn.kicker === "them" ? "text-red-300 font-black" : "text-muted-foreground"}`}>
              {target.userName}: {curTurn.kicker === "them" ? "Kicker" : "Goalkeeper"}
            </span>
          </div>
          <div className="flex items-center justify-between mt-1 text-[9px]">
            <span className={lockedYou ? "text-emerald-300 font-bold" : "text-muted-foreground"}>{lockedYou ? "You locked" : "You picking"}</span>
            <span className={lockedThem ? "text-emerald-300 font-bold" : "text-muted-foreground"}>{lockedThem ? "Rival locked" : "Rival picking"}</span>
          </div>
        </div>

        <div className="relative mx-auto w-full max-w-[320px] aspect-[5/3] rounded-t-2xl border border-border/30 bg-background/45 overflow-hidden">
          <div className="absolute inset-0 grid grid-cols-3 grid-rows-2 gap-px p-1.5">
            {(["tl", "tc", "tr", "bl", "bc", "br"] as PvPGoalZone[]).map((z) => (
              <button
                key={z}
                type="button"
                disabled={!canPickZone}
                onClick={() => setDraftZone(z)}
                className={`rounded-md border text-[8px] font-black transition-all ${
                  draftZone === z
                    ? "border-primary bg-primary/20 text-primary"
                    : canPickZone
                      ? "border-border/25 bg-background/20 text-foreground/70"
                      : "border-border/20 bg-background/10 text-muted-foreground/60"
                }`}
              >
                {z.toUpperCase()}
              </button>
            ))}
          </div>
          <div className={`absolute bottom-1 left-1/2 -translate-x-1/2 text-3xl transition-all ${
            gloveDir === "left" ? "animate-duel-dive-left" : gloveDir === "right" ? "animate-duel-dive-right" : gloveDir === "center" ? "animate-duel-dive-center" : ""
          }`}>
            🧤
          </div>
          {ballAt && (
            <div
              className="absolute w-9 h-9 flex items-center justify-center text-2xl animate-duel-ball-flight"
              style={{ left: PVP_BALL_POS[ballAt].left, top: PVP_BALL_POS[ballAt].top, transform: "translate(-50%, -50%)" }}
            >
              ⚽
            </div>
          )}
        </div>

        {turnPhase === "pick" && (
          <div className="space-y-2">
            <p className="text-[10px] text-muted-foreground">{selectPrompt}</p>
            {yourIsKicker && (
              <div>
                <div className="relative h-4 rounded-full overflow-hidden bg-muted border border-border/20">
                  <div className="absolute top-0 bottom-0 left-[34%] w-[34%] bg-emerald-500/25" />
                  <div className="absolute top-0 bottom-0 w-2 bg-amber-300" style={{ left: `${Math.max(0, powerPct - 2)}%` }} />
                </div>
                <p className="text-[9px] text-muted-foreground mt-1">Power: {Math.round(powerPct)}%</p>
              </div>
            )}
            {!yourIsKicker && (
              <div className="grid grid-cols-3 gap-2">
                {(["high", "curve", "speed"] as PvPShotType[]).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => {
                      if (!canPickZone) return;
                      setDraftShotType(t);
                    }}
                    className={`rounded-xl py-2 text-[10px] font-black uppercase tracking-wide border ${
                      draftShotType === t
                        ? "border-primary bg-primary/15 text-primary"
                        : "border-border/35 bg-background/40 text-foreground/80"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            )}
            <button
              type="button"
              disabled={!canPickZone || !canLockNow}
              onClick={() => {
                if (!draftZone) return;
                lockMyChoice(draftZone, yourIsKicker ? randomShotType() : draftShotType);
              }}
              className={`w-full py-2 rounded-xl text-[10px] font-black ${
                canPickZone && canLockNow
                  ? "bg-gradient-to-r from-red-500 to-rose-600 text-white"
                  : "bg-background/40 text-muted-foreground border border-border/20"
              }`}
            >
              {canPickZone ? "Lock choice" : "Locked"}
            </button>
          </div>
        )}
        {turnPhase === "reveal" && (
          <p className="text-[10px] text-muted-foreground">{lastOutcome?.toUpperCase()} · {lastExplain}</p>
        )}
      </div>
    );
  }

  const topNearby = localFiltered
    .slice()
    .sort((a, b) => (b.wins - b.losses) - (a.wins - a.losses))
    .slice(0, 5);
  const youScoreLabel = `${Math.max(0, activePlayer.level * 18 + activePlayer.attributes.confidence * 3)}`;

  return (
    <div className="py-3 space-y-3">
      <div className="flex gap-2">
        {(["local", "global", "recent"] as PvPTab[]).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase ${tab === t ? "bg-red-500/20 text-red-300 border border-red-500/40" : "bg-background/40 text-muted-foreground border border-border/20"}`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-red-500/20 bg-red-950/20 p-3">
        <p className="text-xs font-black text-foreground mb-2">Zone Leaderboard</p>
        <div className="flex items-center justify-between text-[10px] mb-2">
          <span className="text-muted-foreground">Local Rank</span>
          <span className="font-black text-foreground">#{Math.max(1, 8 - activePlayer.level)}</span>
        </div>
        <div className="flex items-center justify-between text-[10px] mb-2">
          <span className="text-muted-foreground">Your Score</span>
          <span className="font-black text-amber-300">{youScoreLabel}</span>
        </div>
        <div className="space-y-1.5">
          {(tab === "global" ? challengers : topNearby).slice(0, 4).map((c, i) => (
            <div key={c.id} className="flex items-center justify-between text-[10px]">
              <span className="text-foreground font-bold">#{i + 1} @{c.userName}</span>
              <span className="text-muted-foreground">{c.wins}-{c.losses}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-border/20 bg-background/40 p-3">
        <p className="text-xs font-black text-foreground mb-2">Recently Played</p>
        <div className="space-y-1.5">
          {(tab === "recent" ? recentRows : recentRows.slice(0, 2)).map((row) => (
            <p key={row.id} className="text-[10px] text-muted-foreground">
              {row.result} {row.score} · {Math.max(1, Math.round((Date.now() - row.atMs) / 60000))}m ago
            </p>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-black text-foreground">Available Challengers</p>
        {!hasOwned && (
          <div className="rounded-2xl border border-border/20 bg-background/40 p-3 text-[10px] text-muted-foreground">
            Recruit at least one player to challenge nearby users.
          </div>
        )}
        {localFiltered.map((c) => {
          const rp = playersById[c.playerId] ?? getPlayerById(c.playerId);
          if (!rp) return null;
          const isChallengeable =
            hasOwned &&
            c.status === "available" &&
            !duelTargetId &&
            !pendingChallengeId &&
            c.localSessionId === localSessionId &&
            c.region === "New Haven";
          return (
            <div key={c.id} className="rounded-2xl border border-red-500/15 bg-red-950/10 p-3">
              <div className="flex items-center gap-3">
                <AnimatedPortrait player={rp} size="xs" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-foreground truncate">@{c.userName}</p>
                  <p className="text-[10px] text-muted-foreground">
                    Lvl {c.level} · {c.wins}-{c.losses} · {c.status}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={!isChallengeable}
                  onClick={() => issueChallenge(c.id)}
                  className={`px-3 py-2 rounded-xl text-[10px] font-black ${isChallengeable ? "bg-gradient-to-r from-red-500 to-rose-600 text-white" : "bg-background/40 text-muted-foreground border border-border/20"}`}
                >
                  {c.status === "dueling"
                    ? "In Duel"
                    : c.status === "pending_challenge"
                      ? "Pending"
                      : c.status === "cooldown"
                        ? `Cooldown ${Math.max(1, Math.ceil(((c.cooldownUntilMs ?? Date.now()) - Date.now()) / 1000))}s`
                        : c.status === "offline"
                          ? "Offline"
                          : "Challenge"}
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {incomingPrompt && (
        <div className="rounded-2xl border border-amber-400/40 bg-amber-950/20 p-3">
          <p className="text-xs font-black text-foreground">Incoming Challenge</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            @{challengers.find((c) => c.id === incomingPrompt)?.userName} challenged you. Expires in{" "}
            {Math.max(1, Math.ceil(((requestExpiresAt ?? Date.now()) - Date.now()) / 1000))}s.
          </p>
          <div className="flex gap-2 mt-2">
            <button type="button" onClick={acceptChallenge} className="flex-1 py-2 rounded-xl bg-emerald-600 text-white text-[10px] font-black">
              Accept
            </button>
            <button type="button" onClick={declineChallenge} className="flex-1 py-2 rounded-xl bg-background/50 border border-border/20 text-[10px] font-black text-foreground">
              Decline
            </button>
          </div>
        </div>
      )}

      <p className="text-[9px] text-muted-foreground">
        Mock/local mode: grouped by <span className="font-bold text-foreground">localSessionId + region</span>. No real WiFi fingerprint in-browser.
      </p>
    </div>
  );
}

/* ── Pressure Zone: Pressure Clock (blind countdown guess) ──────────── */
const PRESSURE_CUE_LINES = ["Feel the rhythm", "Pressure rising", "Now or never?", "Hold your nerve"] as const;

function rollPressureTargetMs() {
  return 3000 + Math.floor(Math.random() * (30000 - 3000 + 1));
}

function pressureRewardsFromDiff(differenceMs: number): Omit<PressureClockReward, "differenceMs" | "targetMs" | "elapsedMs"> {
  if (differenceMs <= 500) {
    return { tierLabel: "Perfect Clutch", xp: 20, confidence: 10, fp: 8 };
  }
  if (differenceMs <= 1500) {
    return { tierLabel: "Great Timing", xp: 14, confidence: 7, fp: 5 };
  }
  if (differenceMs <= 3000) {
    return { tierLabel: "Good Instinct", xp: 10, confidence: 4, fp: 3 };
  }
  return { tierLabel: "Shaky Nerves", xp: 5, confidence: 1, fp: 1 };
}

function PressureActivity({
  onComplete,
}: {
  onComplete: (score: number, meta?: ActivityCompleteMeta) => void;
}) {
  type ClockPhase = "ready" | "running" | "result";
  const [phase, setPhase] = useState<ClockPhase>("ready");
  const [targetMs, setTargetMs] = useState(rollPressureTargetMs);
  const [cueIdx, setCueIdx] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [differenceMs, setDifferenceMs] = useState(0);
  const [tierPayload, setTierPayload] = useState<PressureClockReward | null>(null);
  const stopHandledRef = useRef(false);

  useEffect(() => {
    if (phase !== "running") return;
    const t = window.setInterval(() => setCueIdx((i) => (i + 1) % PRESSURE_CUE_LINES.length), 2200);
    return () => window.clearInterval(t);
  }, [phase]);

  const handleStart = () => {
    if (phase !== "ready") return;
    stopHandledRef.current = false;
    startTimeRef.current = Date.now();
    setPhase("running");
  };

  const handleStop = () => {
    if (phase !== "running" || stopHandledRef.current || startTimeRef.current === null) return;
    stopHandledRef.current = true;
    const stopTime = Date.now();
    const elapsed = stopTime - startTimeRef.current;
    const diff = Math.abs(elapsed - targetMs);
    const tier = pressureRewardsFromDiff(diff);
    setElapsedMs(elapsed);
    setDifferenceMs(diff);
    setTierPayload({
      ...tier,
      differenceMs: diff,
      targetMs,
      elapsedMs: elapsed,
    });
    setPhase("result");
  };

  const handleRetry = () => {
    setTargetMs(rollPressureTargetMs());
    setPhase("ready");
    startTimeRef.current = null;
    setTierPayload(null);
    setElapsedMs(0);
    setDifferenceMs(0);
    stopHandledRef.current = false;
    setCueIdx(0);
  };

  const handleClaimRewards = () => {
    if (!tierPayload) return;
    onComplete(0, { pressureClock: tierPayload });
  };

  const targetWholeSec = Math.round(targetMs / 1000);

  return (
    <div
      className="py-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]"
      style={{ touchAction: "manipulation" }}
    >
      <p className="text-xs font-black text-foreground tracking-tight">Pressure Clock</p>

      {phase === "ready" && (
        <div className="mt-3 space-y-3">
          <p className="text-2xl font-black text-foreground tabular-nums">
            Target: {targetWholeSec} second{targetWholeSec === 1 ? "" : "s"}
          </p>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Memorize it. The clock disappears after you start.
          </p>
          <button
            type="button"
            onClick={handleStart}
            className="w-full min-h-[52px] rounded-2xl bg-gradient-to-r from-violet-600 to-rose-600 text-white font-black text-sm shadow-lg active:scale-[0.98] transition-transform"
          >
            Start
          </button>
        </div>
      )}

      {phase === "running" && (
        <div className="mt-4 space-y-4">
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            Trust your instinct. Stop when the hidden clock hits zero.
          </p>
          <div className="relative mx-auto flex h-44 w-44 items-center justify-center rounded-full border-2 border-orange-500/35 bg-gradient-to-b from-orange-500/10 via-background/80 to-background shadow-[0_0_40px_rgba(249,115,22,0.18)] animate-pulse">
            <div className="absolute inset-3 rounded-full border border-rose-500/25 animate-pulse" style={{ animationDuration: "1.1s" }} />
            <div className="relative text-center px-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-orange-300/90">Pressure</p>
              <p className="mt-2 text-xs font-bold text-foreground">{PRESSURE_CUE_LINES[cueIdx]}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleStop}
            className="w-full min-h-[56px] rounded-2xl border-2 border-rose-500/50 bg-rose-950/40 text-rose-100 font-black text-base shadow-[0_0_24px_rgba(244,63,94,0.25)] active:scale-[0.98] transition-transform"
          >
            Stop
          </button>
        </div>
      )}

      {phase === "result" && tierPayload && (
        <div className="mt-3 space-y-3">
          <div className="rounded-2xl border border-violet-500/25 bg-violet-950/30 p-3 text-left space-y-1.5">
            <p className="text-sm font-black text-foreground">{tierPayload.tierLabel}</p>
            <p className="text-[10px] text-muted-foreground">
              Target: <span className="font-bold text-foreground">{(tierPayload.targetMs / 1000).toFixed(2)}s</span>
              {" · "}
              You stopped: <span className="font-bold text-foreground">{(tierPayload.elapsedMs / 1000).toFixed(2)}s</span>
            </p>
            <p className="text-[10px] text-muted-foreground">
              Difference: <span className="font-bold text-foreground">{Math.round(tierPayload.differenceMs)}ms</span>
            </p>
            <p className="text-[10px] text-emerald-300/95 pt-1">
              Rewards: +{tierPayload.confidence} Confidence · +{tierPayload.xp} XP · +{tierPayload.fp} FP
            </p>
          </div>
          <div className="flex flex-col gap-2">
            <button
              type="button"
              onClick={handleClaimRewards}
              className="w-full min-h-[50px] rounded-2xl bg-gradient-to-r from-violet-600 to-purple-600 text-white font-black text-sm active:scale-[0.98] transition-transform"
            >
              Claim rewards
            </button>
            <button
              type="button"
              onClick={handleRetry}
              className="w-full min-h-[48px] rounded-2xl border border-border/40 bg-background/60 text-foreground font-bold text-sm active:scale-[0.98] transition-transform"
            >
              Try again
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Stadium Zone: Passing Triangle ───────────────────────────────────── */
const PT_FIELD = 380;
const PT_CX = PT_FIELD / 2;
const PT_CY = PT_FIELD / 2;
const PT_PAD = 14;
const PT_R_MOVE = 82;
/** Bots must stay outside this radius from pitch center (defender zone + margin). */
const PT_R_GUARD = PT_R_MOVE + 36;
const PT_BOT_ANGLES = [-Math.PI / 2, Math.PI / 6, (5 * Math.PI) / 6] as const;

type PtBot = { x: number; y: number; tx: number; ty: number; nextRetargetAt: number };
type PtLeg = {
  from: number;
  to: number;
  start: number;
  dur: number;
  curved: boolean;
  p0: { x: number; y: number };
  p2: { x: number; y: number };
  ctrl: { x: number; y: number };
};

function makeInitialPtBots(): PtBot[] {
  const ring = PT_R_GUARD + 38;
  return PT_BOT_ANGLES.map((ang) => {
    const x = PT_CX + Math.cos(ang) * ring;
    const y = PT_CY + Math.sin(ang) * ring;
    const c = clampBotOutsideCenter(x, y, PT_CX, PT_CY, PT_R_GUARD, PT_PAD, PT_FIELD);
    return { x: c.x, y: c.y, tx: c.x, ty: c.y, nextRetargetAt: 0 };
  });
}

function tryPickBotTarget(i: number, bots: PtBot[], diff: ReturnType<typeof passingTriangleDifficulty>) {
  const others = bots.filter((_, j) => j !== i).map((b) => ({ x: b.x, y: b.y }));
  for (let k = 0; k < 14; k++) {
    const anchor = PT_BOT_ANGLES[i]!;
    const ang = anchor + (Math.random() - 0.5) * 1.2;
    const outer = PT_FIELD / 2 - PT_PAD - 8;
    const rad = PT_R_GUARD + 10 + Math.random() * Math.max(10, outer - PT_R_GUARD - 14);
    const rawX = PT_CX + Math.cos(ang) * rad;
    const rawY = PT_CY + Math.sin(ang) * rad;
    const p = clampBotOutsideCenter(rawX, rawY, PT_CX, PT_CY, PT_R_GUARD, PT_PAD, PT_FIELD);
    let ok = true;
    for (const o of others) {
      if (Math.hypot(p.x - o.x, p.y - o.y) < 24) ok = false;
    }
    if (ok) return { x: p.x, y: p.y };
  }
  const a = PT_BOT_ANGLES[i]!;
  return clampBotOutsideCenter(
    PT_CX + Math.cos(a) * (PT_R_GUARD + 30),
    PT_CY + Math.sin(a) * (PT_R_GUARD + 30),
    PT_CX,
    PT_CY,
    PT_R_GUARD,
    PT_PAD,
    PT_FIELD
  );
}

function StadiumActivity({
  onComplete,
}: {
  onComplete: (score: number, meta?: ActivityCompleteMeta) => void;
}) {
  const { activePlayer } = useGameProgress();
  type PtPhase = "ready" | "playing" | "result";

  const fieldRef = useRef<HTMLDivElement>(null);
  const [phase, setPhase] = useState<PtPhase>("ready");
  const [readyN, setReadyN] = useState(3);
  const [remaining, setRemaining] = useState(30);
  const [urgency, setUrgency] = useState<"high" | "mid" | "low">("high");
  const [, setRender] = useState(0);
  const [resultPayload, setResultPayload] = useState<PassingTriangleReward | null>(null);

  const defenderRef = useRef({ x: PT_CX, y: PT_CY });
  const targetRef = useRef({ x: PT_CX, y: PT_CY });
  const botsRef = useRef<PtBot[]>(makeInitialPtBots());
  const ballRef = useRef({ x: botsRef.current[0]!.x, y: botsRef.current[0]!.y });
  const playStartRef = useRef(0);
  const holderRef = useRef(0);
  const legRef = useRef<PtLeg | null>(null);
  const gapEndRef = useRef(0);
  const endedRef = useRef(false);
  const rafRef = useRef<number>(0);

  const resetRun = useCallback(() => {
    endedRef.current = false;
    defenderRef.current = { x: PT_CX, y: PT_CY };
    targetRef.current = { x: PT_CX, y: PT_CY };
    botsRef.current = makeInitialPtBots();
    ballRef.current = { x: botsRef.current[0]!.x, y: botsRef.current[0]!.y };
    holderRef.current = 0;
    legRef.current = null;
    gapEndRef.current = 0;
    playStartRef.current = 0;
    setResultPayload(null);
    setRemaining(30);
    setUrgency("high");
    setReadyN(3);
    setPhase("ready");
  }, []);

  useEffect(() => {
    if (phase !== "ready") return;
    if (readyN < 0) return;
    if (readyN === 0) {
      playStartRef.current = performance.now();
      gapEndRef.current = 0;
      holderRef.current = 0;
      legRef.current = null;
      setPhase("playing");
      return;
    }
    const id = window.setTimeout(() => setReadyN((n) => n - 1), 1000);
    return () => window.clearTimeout(id);
  }, [phase, readyN]);

  useEffect(() => {
    if (phase !== "playing") return;
    endedRef.current = false;
    let last = performance.now();

    const tick = (now: number) => {
      if (endedRef.current) return;
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const played = (now - playStartRef.current) / 1000;
      if (played >= 30) {
        endedRef.current = true;
        setResultPayload(missedPassingTriangleReward());
        setPhase("result");
        return;
      }
      setRemaining(Math.max(0, 30 - played));
      setUrgency(played < 10 ? "high" : played < 20 ? "mid" : "low");
      const diff = passingTriangleDifficulty(played);

      const startFrameBots = botsRef.current.map((b) => ({ ...b }));
      const nextBots = startFrameBots.map((b) => ({ ...b }));
      for (let i = 0; i < 3; i++) {
        const bb = nextBots[i]!;
        if (now >= bb.nextRetargetAt) {
          const t = tryPickBotTarget(i, startFrameBots, diff);
          bb.tx = t.x;
          bb.ty = t.y;
          bb.nextRetargetAt = now + randRange(diff.botRetargetMin, diff.botRetargetMax);
        }
        const dx = bb.tx - bb.x;
        const dy = bb.ty - bb.y;
        const dist = Math.hypot(dx, dy);
        if (dist > 0.25) {
          const mv = Math.min(dist, diff.botSpeed * dt);
          bb.x += (dx / dist) * mv;
          bb.y += (dy / dist) * mv;
        }
      }
      const separated = separateBotTriad(
        nextBots.map((b) => ({ x: b.x, y: b.y })),
        26,
        PT_CX,
        PT_CY,
        PT_R_GUARD,
        PT_PAD,
        PT_FIELD
      );
      for (let i = 0; i < 3; i++) {
        nextBots[i]!.x = separated[i]!.x;
        nextBots[i]!.y = separated[i]!.y;
      }
      botsRef.current = nextBots;

      if (legRef.current === null) {
        if (now >= gapEndRef.current) {
          const from = holderRef.current;
          const others = [0, 1, 2].filter((j) => j !== from) as [number, number];
          const to = others[Math.floor(Math.random() * 2)]!;
          const bFrom = botsRef.current[from]!;
          const bTo = botsRef.current[to]!;
          const p0 = { x: bFrom.x, y: bFrom.y };
          const p2 = { x: bTo.x, y: bTo.y };
          const mx = (p0.x + p2.x) / 2;
          const my = (p0.y + p2.y) / 2;
          const curved = Math.random() < diff.curveChance;
          let ctrl = { x: mx, y: my };
          if (curved) {
            const vx = p2.x - p0.x;
            const vy = p2.y - p0.y;
            const len = Math.hypot(vx, vy) || 1;
            const perpX = -vy / len;
            const perpY = vx / len;
            const sign = Math.random() < 0.5 ? -1 : 1;
            const amp = 14 + Math.random() * 12;
            ctrl = { x: mx + perpX * amp * sign, y: my + perpY * amp * sign };
          }
          legRef.current = {
            from,
            to,
            start: now,
            dur: randRange(diff.ballMin, diff.ballMax),
            curved,
            p0,
            p2,
            ctrl,
          };
        }
      } else {
        const leg = legRef.current;
        const u = Math.min(1, (now - leg.start) / leg.dur);
        const bpos = leg.curved
          ? quadBezierPoint(leg.p0, leg.ctrl, leg.p2, u)
          : { x: leg.p0.x + (leg.p2.x - leg.p0.x) * u, y: leg.p0.y + (leg.p2.y - leg.p0.y) * u };
        ballRef.current = bpos;

        const dr = defenderRef.current;
        const dBall = Math.hypot(dr.x - bpos.x, dr.y - bpos.y);
        if (dBall < diff.interceptR) {
          endedRef.current = true;
          setResultPayload(passingTriangleTierForIntercept(played));
          setPhase("result");
          return;
        }

        if (u >= 1) {
          holderRef.current = leg.to;
          legRef.current = null;
          gapEndRef.current = now + randRange(diff.passGapMin, diff.passGapMax);
        }
      }

      const tgt = targetRef.current;
      const d = defenderRef.current;
      const vx = tgt.x - d.x;
      const vy = tgt.y - d.y;
      const len = Math.hypot(vx, vy);
      const speed = 128;
      if (len > 0.5) {
        const step = Math.min(len, speed * dt);
        const nx = d.x + (vx / len) * step;
        const ny = d.y + (vy / len) * step;
        const cl = clampToDisk(nx, ny, PT_CX, PT_CY, PT_R_MOVE);
        defenderRef.current = cl;
      }

      setRender((x) => x + 1);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase]);

  useEffect(() => () => cancelAnimationFrame(rafRef.current), []);

  const toField = (clientX: number, clientY: number) => {
    const el = fieldRef.current;
    if (!el) return { x: PT_CX, y: PT_CY };
    const r = el.getBoundingClientRect();
    const x = ((clientX - r.left) / r.width) * PT_FIELD;
    const y = ((clientY - r.top) / r.height) * PT_FIELD;
    return clampToDisk(x, y, PT_CX, PT_CY, PT_R_MOVE);
  };

  const onFieldPointer = (e: PointerEvent<HTMLDivElement>) => {
    if (phase !== "playing" || endedRef.current) return;
    const p = toField(e.clientX, e.clientY);
    targetRef.current = p;
  };

  const handleClaim = () => {
    if (!resultPayload) return;
    const t = resultPayload.interceptElapsedSec ?? 0;
    onComplete(Math.round(t * 10), { passingTriangle: resultPayload });
  };

  const d = defenderRef.current;
  const b = ballRef.current;
  const bots = botsRef.current;

  return (
    <div
      className="py-2 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] select-none"
      style={{ touchAction: phase === "playing" ? "none" : "manipulation" }}
    >
      <p className="text-xs font-black text-foreground tracking-tight">Passing Triangle</p>
      <p className="text-[10px] text-muted-foreground mt-0.5">Monkey in the middle — read the ball.</p>

      <div
        ref={fieldRef}
        className="relative mx-auto mt-3 rounded-2xl border border-yellow-500/25 bg-gradient-to-b from-emerald-950/50 via-background/90 to-background overflow-hidden max-h-[min(72dvh,420px)] w-[min(100%,min(92vw,400px))] aspect-square"
        onPointerDown={onFieldPointer}
      >
        <svg
          viewBox={`0 0 ${PT_FIELD} ${PT_FIELD}`}
          className="absolute inset-0 h-full w-full"
          aria-hidden
        >
          <defs>
            <radialGradient id="ptPitch" cx="50%" cy="40%" r="70%">
              <stop offset="0%" stopColor="rgba(34,197,94,0.12)" />
              <stop offset="100%" stopColor="rgba(0,0,0,0.35)" />
            </radialGradient>
          </defs>
          <rect width={PT_FIELD} height={PT_FIELD} fill="url(#ptPitch)" />
          <circle
            cx={PT_CX}
            cy={PT_CY}
            r={PT_R_MOVE}
            fill="none"
            stroke={urgency === "high" ? "rgba(251,191,36,0.55)" : "rgba(148,163,184,0.45)"}
            strokeWidth={urgency === "high" ? 3 : 2}
            strokeDasharray={phase === "ready" ? "6 4" : "0"}
          />
        </svg>

        {bots.map((p, i) => (
          <div
            key={`bot-${i}`}
            className="absolute flex flex-col items-center pointer-events-none"
            style={{
              left: `${(p.x / PT_FIELD) * 100}%`,
              top: `${(p.y / PT_FIELD) * 100}%`,
              transform: "translate(-50%, -50%)",
            }}
          >
            <div className="h-9 w-9 rounded-full border border-border/40 bg-muted/80 flex items-center justify-center text-[10px] font-black text-foreground">
              {i + 1}
            </div>
            <span className="mt-0.5 max-w-[5rem] text-center text-[8px] font-bold text-muted-foreground leading-tight">
              Bot Passer {i + 1}
            </span>
          </div>
        ))}

        <div
          className="absolute rounded-full border-2 border-primary bg-primary/25 shadow-lg flex items-center justify-center pointer-events-none overflow-hidden"
          style={{
            left: `${(d.x / PT_FIELD) * 100}%`,
            top: `${(d.y / PT_FIELD) * 100}%`,
            width: "14%",
            height: "14%",
            transform: "translate(-50%, -50%)",
          }}
        >
          <div className="scale-[0.65]">
            <AnimatedPortrait player={activePlayer} size="sm" />
          </div>
        </div>

        <div
          className="absolute rounded-full bg-white border-2 border-amber-400 shadow-md pointer-events-none"
          style={{
            left: `${(b.x / PT_FIELD) * 100}%`,
            top: `${(b.y / PT_FIELD) * 100}%`,
            width: "7%",
            height: "7%",
            transform: "translate(-50%, -50%)",
          }}
        />

        {phase === "ready" && readyN > 0 && (
          <div className="absolute inset-0 flex items-center justify-center bg-background/55 backdrop-blur-[2px]">
            <p className="text-5xl font-black text-foreground tabular-nums">{readyN}</p>
          </div>
        )}

        {phase === "playing" && (
          <div className="absolute left-2 right-2 top-2 flex items-center justify-between gap-2 pointer-events-none">
            <div
              className={`rounded-full px-2 py-1 text-[10px] font-black ${
                urgency === "high"
                  ? "bg-rose-600/90 text-white animate-pulse"
                  : urgency === "mid"
                    ? "bg-amber-500/85 text-black"
                    : "bg-emerald-600/80 text-white"
              }`}
            >
              {remaining.toFixed(1)}s
            </div>
            <div className="rounded-full bg-background/80 px-2 py-1 text-[9px] font-bold text-muted-foreground border border-border/30">
              {urgency === "high" ? "Sharp passes" : urgency === "mid" ? "Readable" : "Tired legs"}
            </div>
          </div>
        )}
      </div>

      {phase === "ready" && (
        <p className="text-[10px] text-muted-foreground mt-3 leading-relaxed px-1">
          Stay inside the circle. Cut the passing lane before time runs out.
        </p>
      )}

      {phase === "playing" && (
        <p className="text-[10px] text-muted-foreground mt-2 px-1">
          Tap inside the pitch to move your defender. Intercept the ball before 30s.
        </p>
      )}

      {phase === "result" && resultPayload && (
        <div className="mt-4 space-y-3">
          <div className="rounded-2xl border border-yellow-500/25 bg-yellow-950/25 p-3 text-left space-y-1.5">
            <p className="text-sm font-black text-foreground">{resultPayload.tierLabel}</p>
            {resultPayload.won && resultPayload.interceptElapsedSec !== null && (
              <p className="text-[10px] text-muted-foreground">
                Intercept at{" "}
                <span className="font-bold text-foreground">{resultPayload.interceptElapsedSec.toFixed(2)}s</span> game
                time
              </p>
            )}
            {!resultPayload.won && (
              <p className="text-[10px] text-muted-foreground">30 seconds — no interception.</p>
            )}
            <p className="text-[10px] text-emerald-300/95 pt-1">
              +{resultPayload.xp} XP · +{resultPayload.form} Form ·
              {resultPayload.confidence > 0 ? ` +${resultPayload.confidence} Confidence ·` : ""} +
              {resultPayload.eventPoints} Event Pts
            </p>
            <p className="text-[9px] text-muted-foreground/80">
              Event Points apply as Focus Points in this client build.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClaim}
            className="w-full min-h-[50px] rounded-2xl bg-gradient-to-r from-yellow-500 to-amber-600 text-black font-black text-sm active:scale-[0.98] transition-transform"
          >
            Claim rewards
          </button>
          <button
            type="button"
            onClick={resetRun}
            className="w-full min-h-[48px] rounded-2xl border border-border/40 bg-background/60 text-foreground font-bold text-sm active:scale-[0.98] transition-transform"
          >
            Retry
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main ZoneExperience component ─────────────────────────────────────── */
const ZoneExperience = ({ zone, onClose }: ZoneExperienceProps) => {
  const [step, setStep] = useState<ZoneStep>("intro");
  const [activityScore, setActivityScore] = useState(0);
  const [trainingMeta, setTrainingMeta] = useState<TrainingTriviaMeta | null>(null);
  const [pressureClockResult, setPressureClockResult] = useState<PressureClockReward | null>(null);
  const [passingTriangleResult, setPassingTriangleResult] = useState<PassingTriangleReward | null>(null);
  const { activePlayer, addXp, applyAttributeDelta, addFocusPoints } = useGameProgress();
  const config = zoneConfig[zone.type];
  const Icon = config.icon;

  useEffect(() => {
    setStep("intro");
    setActivityScore(0);
    setTrainingMeta(null);
    setPressureClockResult(null);
    setPassingTriangleResult(null);
  }, [zone.id]);

  const handleActivityComplete = useCallback(
    (score: number, meta?: ActivityCompleteMeta) => {
      setActivityScore(score);

      if (isPressureClockMeta(meta)) {
        const pc = meta.pressureClock;
        setPressureClockResult(pc);
        addXp(activePlayer.id, pc.xp);
        applyAttributeDelta(activePlayer.id, { confidence: pc.confidence });
        if (pc.fp > 0) addFocusPoints(pc.fp);
        setStep("reward");
        return;
      }

      if (isPassingTriangleMeta(meta)) {
        const pt = meta.passingTriangle;
        setPassingTriangleResult(pt);
        addXp(activePlayer.id, pt.xp);
        const attr: Partial<{ form: number; confidence: number }> = { form: pt.form };
        if (pt.confidence > 0) attr.confidence = pt.confidence;
        applyAttributeDelta(activePlayer.id, attr);
        if (pt.eventPoints > 0) addFocusPoints(pt.eventPoints);
        setStep("reward");
        return;
      }

      if (zone.type === "training") setTrainingMeta((meta as TrainingTriviaMeta | undefined) ?? null);

      const trainingEffectiveScore =
        zone.type === "training" ? score + ((meta as TrainingTriviaMeta | undefined)?.streakBonus ?? 0) : score;
      const mult =
        zone.type === "rival"
          ? 1
          : zone.type === "training"
            ? Math.max(0.5, Math.min(1.6, trainingEffectiveScore / 6))
            : Math.max(0.5, Math.min(1.5, score / 3));
      const xpGain = Math.round(config.xp * mult);
      const attrGain = Math.max(1, Math.round(config.attrGain * mult));
      addXp(activePlayer.id, xpGain);
      applyAttributeDelta(activePlayer.id, { [config.attribute]: attrGain });
      if (config.fpGain > 0) addFocusPoints(config.fpGain);
      setStep("reward");
    },
    [activePlayer.id, config, addXp, applyAttributeDelta, addFocusPoints, zone.type]
  );

  // For rival zone, skip the intro and go straight to activity
  const isRival = zone.type === "rival";

  const renderActivity = () => {
    switch (zone.type) {
      case "training": return <TrainingActivity onComplete={handleActivityComplete} />;
      case "rival": return <RivalPitchActivity onComplete={handleActivityComplete} />;
      case "pressure": return <PressureActivity onComplete={handleActivityComplete} />;
      case "stadium": return <StadiumActivity onComplete={handleActivityComplete} />;
      default: return <TrainingActivity onComplete={handleActivityComplete} />;
    }
  };

  const scoreLabel = () => {
    if (zone.type === "training") {
      const total = trainingMeta?.totalQuestions ?? 10;
      const bonus = trainingMeta?.streakBonus ?? 0;
      const bestStreak = trainingMeta?.maxStreak ?? 0;
      return `${activityScore}/${total} correct · +${bonus} streak bonus · best streak ${bestStreak}`;
    }
    if (zone.type === "pressure" && pressureClockResult) {
      const pc = pressureClockResult;
      return `${pc.tierLabel} · target ${(pc.targetMs / 1000).toFixed(2)}s · stopped ${(pc.elapsedMs / 1000).toFixed(2)}s · Δ ${Math.round(pc.differenceMs)}ms`;
    }
    if (zone.type === "pressure") return "Pressure Clock";
    if (zone.type === "stadium" && passingTriangleResult) {
      const pt = passingTriangleResult;
      return `${pt.tierLabel}${pt.won && pt.interceptElapsedSec != null ? ` · ${pt.interceptElapsedSec.toFixed(2)}s` : ""}`;
    }
    if (zone.type === "stadium") return "Passing Triangle";
    if (zone.type === "rival") return "Challenge complete";
    return "Complete";
  };

  const effectiveTrainingScore = zone.type === "training" ? activityScore + (trainingMeta?.streakBonus ?? 0) : activityScore;
  const mult =
    zone.type === "rival"
      ? 1
      : zone.type === "training"
        ? Math.max(0.5, Math.min(1.6, effectiveTrainingScore / 6))
        : Math.max(0.5, Math.min(1.5, activityScore / 3));
  const finalXp = pressureClockResult
    ? pressureClockResult.xp
    : passingTriangleResult
      ? passingTriangleResult.xp
      : Math.round(config.xp * mult);
  const finalAttr = pressureClockResult
    ? pressureClockResult.confidence
    : passingTriangleResult
      ? passingTriangleResult.form
      : Math.max(1, Math.round(config.attrGain * mult));
  const finalFp = pressureClockResult
    ? pressureClockResult.fp
    : passingTriangleResult
      ? passingTriangleResult.eventPoints
      : config.fpGain;

  return (
    <div className="fixed inset-0 z-[1350] flex items-end justify-center bg-background/50 backdrop-blur-sm" onClick={onClose}>
      <div
        className="w-full max-w-lg animate-slide-up rounded-t-3xl bg-background/95 backdrop-blur-xl border-t border-border/20 overflow-hidden"
        style={{
          paddingBottom: isRival
            ? "calc(env(safe-area-inset-bottom) + 24px)"
            : "max(1.5rem, env(safe-area-inset-bottom))",
          maxHeight: isRival ? "calc(100dvh - 96px)" : "90dvh",
          overflowY: isRival ? "auto" : undefined,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 bg-muted-foreground/30 rounded-full mx-auto mt-2 mb-1" />

        {/* Header — always visible */}
        <div className="flex items-center justify-between px-5 pt-2 pb-3">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className={`w-11 h-11 rounded-2xl flex items-center justify-center text-xl shrink-0 ${config.bgAccent} ring-1 ${config.ringColor}`}>
              {config.emoji}
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-black text-foreground truncate">{zone.name}</h3>
              <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {config.rewardLabel}
              </p>
            </div>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60 shrink-0">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Scrollable content */}
        <div
          className="px-5 pb-4 overflow-y-auto"
          style={{ maxHeight: isRival ? "calc(100dvh - 96px - 5rem)" : "calc(85dvh - 5rem)" }}
        >
          {/* ── INTRO ── */}
          {step === "intro" && !isRival && (
            <div className="animate-fade-in">
              <div className={`p-4 rounded-2xl mb-4 ${config.bgAccent} ring-1 ${config.ringColor}`}>
                <div className="flex items-start gap-3">
                  <Icon className="w-5 h-5 shrink-0 mt-0.5 text-foreground/70" />
                  <p className="text-xs text-foreground leading-relaxed">{config.purpose}</p>
                </div>
              </div>

              {/* Active player */}
              <div className="glass-card p-3 rounded-2xl mb-4 flex items-center gap-3">
                <AnimatedPortrait player={activePlayer} size="sm" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-foreground truncate">{activePlayer.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {activePlayer.position} · Level {activePlayer.level}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[9px] text-muted-foreground uppercase">Current</p>
                  <p className="text-sm font-black text-foreground">
                    {activePlayer.attributes[config.attribute]}
                  </p>
                </div>
              </div>

              {/* Possible rewards */}
              <div className="flex gap-2 mb-4">
                {[
                  { label: `+${config.attrGain} ${config.attribute.charAt(0).toUpperCase() + config.attribute.slice(1)}`, icon: "📈" },
                  { label: `+${config.xp} XP`, icon: "⭐" },
                  { label: `+${config.fpGain} FP`, icon: "🎯" },
                ].map((r) => (
                  <div key={r.label} className="flex-1 glass-card px-2 py-2 rounded-xl text-center">
                    <span className="text-sm">{r.icon}</span>
                    <p className="text-[10px] font-bold text-foreground mt-0.5">{r.label}</p>
                  </div>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setStep("activity")}
                className={`w-full py-3.5 rounded-2xl bg-gradient-to-r ${config.gradient} text-white font-black text-sm flex items-center justify-center gap-2 active:scale-[0.97] transition-transform shadow-lg`}
              >
                {config.cta} <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* ── ACTIVITY ── */}
          {(step === "activity" || (step === "intro" && isRival)) && (
            <div className="animate-fade-in">
              {isRival && step === "intro" ? (
                <RivalPitchActivity onComplete={handleActivityComplete} />
              ) : (
                renderActivity()
              )}
            </div>
          )}

          {/* ── REWARD ── */}
          {step === "reward" && (
            <div className="animate-fade-in text-center py-4">
              <div className={`w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center ${config.bgAccent} ring-2 ${config.ringColor}`}>
                <Check className="w-8 h-8 text-foreground" />
              </div>
              <h3 className="text-xl font-black text-foreground mb-1">Zone Complete!</h3>
              <p className="text-xs text-muted-foreground mb-1">{zone.name}</p>
              <p className="text-[10px] text-muted-foreground mb-4">{scoreLabel()}</p>

              <div className="flex flex-wrap gap-2 justify-center mb-5">
                {passingTriangleResult ? (
                  [
                    { label: `+${passingTriangleResult.form} Form`, icon: "📈" },
                    ...(passingTriangleResult.confidence > 0
                      ? [{ label: `+${passingTriangleResult.confidence} Confidence`, icon: "💪" }]
                      : []),
                    { label: `+${passingTriangleResult.xp} XP`, icon: "⭐" },
                    { label: `+${passingTriangleResult.eventPoints} Event Pts`, icon: "🏟️" },
                  ].map((r) => (
                    <div key={r.label} className={`px-3 py-2 rounded-xl ${config.bgAccent} ring-1 ${config.ringColor}`}>
                      <span className="text-sm">{r.icon}</span>
                      <p className="text-[10px] font-bold text-foreground mt-0.5">{r.label}</p>
                    </div>
                  ))
                ) : (
                  [
                    { label: `+${finalAttr} ${config.attribute.charAt(0).toUpperCase() + config.attribute.slice(1)}`, icon: "📈" },
                    { label: `+${finalXp} XP`, icon: "⭐" },
                    { label: `+${finalFp} FP`, icon: "🎯" },
                  ].map((r) => (
                    <div key={r.label} className={`px-3 py-2 rounded-xl ${config.bgAccent} ring-1 ${config.ringColor}`}>
                      <span className="text-sm">{r.icon}</span>
                      <p className="text-[10px] font-bold text-foreground mt-0.5">{r.label}</p>
                    </div>
                  ))
                )}
              </div>
              {passingTriangleResult && (
                <p className="text-[9px] text-muted-foreground mb-4 -mt-2 px-2">
                  Event Points are credited as Focus Points in this client build.
                </p>
              )}

              <button
                type="button"
                onClick={onClose}
                className={`w-full py-3.5 rounded-2xl bg-gradient-to-r ${config.gradient} text-white font-black text-sm active:scale-[0.97] transition-transform shadow-lg`}
              >
                Continue Exploring
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ZoneExperience;
