import { useState, useEffect, useCallback, useRef } from "react";
import {
  X, Dumbbell, Heart, Users, Swords, Flame, Trophy,
  ChevronRight, Check, Zap, Wind, Shield, Star, Timer,
} from "lucide-react";
import type { MapZone } from "@/data/mockData";
import { mockRivals, getPlayerById } from "@/data/mockData";
import { useGameProgress } from "@/context/GameProgressContext";
import {
  fetchTrainingTriviaSession,
  type ApiTrainingTriviaQuestion,
} from "@/lib/apiService";
import AnimatedPortrait from "./AnimatedPortrait";
import ChallengeFlow from "./ChallengeFlow";

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
  recovery: {
    icon: Heart,
    emoji: "💆",
    purpose: "Recovery Rhythm: time calm actions to restore match readiness fast.",
    cta: "Start Recovery Rhythm",
    rewardLabel: "+Morale",
    attribute: "morale",
    xp: 15,
    attrGain: 4,
    fpGain: 2,
    gradient: "from-sky-400 to-blue-500",
    bgAccent: "bg-sky-500/10",
    ringColor: "ring-sky-500/30",
  },
  "fan-arena": {
    icon: Users,
    emoji: "📣",
    purpose: "Zone Control Battle: challenge the current holder and claim fan-zone control.",
    cta: "Start Zone Control",
    rewardLabel: "+Fan Bond",
    attribute: "fanBond",
    xp: 15,
    attrGain: 4,
    fpGain: 1,
    gradient: "from-orange-400 to-amber-500",
    bgAccent: "bg-amber-500/10",
    ringColor: "ring-amber-500/30",
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
    purpose: "Clutch Moment Challenge: choose the right response in high-pressure moments.",
    cta: "Enter Clutch Moment",
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
    purpose: "Squad Power Clash: assign Captain/Attacker/Defender and resolve 3 key phases.",
    cta: "Start Squad Clash",
    rewardLabel: "+All Stats",
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

/* ── Recovery Center: Breathing / Calm Timer ───────────────────────────── */
function RecoveryActivity({ onComplete }: { onComplete: (score: number) => void }) {
  const ACTIONS = ["Breathe", "Hydrate", "Stretch", "Ice Bath", "Physio Reset"] as const;
  const CONDITIONS = ["Tired", "Tense", "Sore", "Low morale"] as const;
  const [step, setStep] = useState(0);
  const [phase, setPhase] = useState<"calm" | "push">("push");
  const [timeLeft, setTimeLeft] = useState(12);
  const [hits, setHits] = useState(0);
  const [lastAction, setLastAction] = useState<string>("Tap on calm");

  useEffect(() => {
    const toggle = window.setInterval(() => {
      setPhase((p) => (p === "calm" ? "push" : "calm"));
      setStep((s) => (s + 1) % ACTIONS.length);
    }, 1200);
    return () => window.clearInterval(toggle);
  }, []);

  useEffect(() => {
    if (timeLeft <= 0) {
      onComplete(Math.min(6, Math.max(1, Math.round((hits / 10) * 6))));
      return;
    }
    const t = window.setTimeout(() => setTimeLeft((v) => v - 1), 1000);
    return () => window.clearTimeout(t);
  }, [timeLeft, hits, onComplete]);

  const tap = () => {
    setLastAction(ACTIONS[step] ?? "Recover");
    if (phase === "calm") setHits((h) => h + 1);
  };

  return (
    <div className="py-4">
      <p className="text-xs font-black text-foreground">Recovery Rhythm</p>
      <p className="text-[10px] text-muted-foreground mb-3">Condition: {CONDITIONS[(step + 1) % CONDITIONS.length]}</p>
      <div className="h-3 rounded-full overflow-hidden bg-muted mb-3">
        <div
          className={`h-full transition-all duration-300 ${phase === "calm" ? "bg-sky-400" : "bg-rose-400/70"}`}
          style={{ width: `${phase === "calm" ? 100 : 45}%` }}
        />
      </div>
      <button
        type="button"
        onClick={tap}
        className="w-full py-5 rounded-2xl bg-sky-500/10 border border-sky-500/25 active:scale-[0.98] transition-transform"
      >
        <p className="text-sm font-black text-foreground">{ACTIONS[step]}</p>
        <p className="text-[10px] text-muted-foreground mt-1">{phase === "calm" ? "Tap now" : "Hold your pace"}</p>
      </button>
      <div className="flex items-center justify-between mt-3 text-[10px]">
        <p className="text-muted-foreground">Good timings: <span className="font-black text-foreground">{hits}</span></p>
        <p className="text-muted-foreground">Time: <span className="font-black text-foreground">{timeLeft}s</span></p>
      </div>
      <p className="text-[10px] text-sky-300 mt-1">Last: {lastAction} · Pressure Calm boost chance on strong rhythm</p>
    </div>
  );
}

/* ── Fan Arena: Hype Meter Tap ─────────────────────────────────────────── */
function FanArenaActivity({ onComplete }: { onComplete: (score: number) => void }) {
  const [holder] = useState("Ultra Fans Union");
  const [you, setYou] = useState(45);
  const [them, setThem] = useState(55);
  const [timeLeft, setTimeLeft] = useState(10);
  const [resolved, setResolved] = useState(false);

  useEffect(() => {
    if (resolved) return;
    if (timeLeft <= 0) {
      setResolved(true);
      onComplete(you >= them ? 6 : 3);
      return;
    }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, resolved, you, them, onComplete]);

  const push = () => {
    if (resolved) return;
    setYou((v) => Math.min(100, v + 7));
    setThem((v) => Math.max(0, v - 5));
  };

  return (
    <div className="py-4">
      <p className="text-xs font-black text-foreground">Zone Control Battle</p>
      <p className="text-[10px] text-muted-foreground mb-3">Current holder: {holder}</p>
      <div className="h-4 bg-muted rounded-full overflow-hidden mb-3 flex">
        <div className="h-full bg-orange-500/80 transition-all" style={{ width: `${you}%` }} />
        <div className="h-full bg-zinc-500/80 transition-all" style={{ width: `${them}%` }} />
      </div>
      <button
        type="button"
        onClick={push}
        disabled={resolved}
        className="w-full py-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 active:scale-[0.98] transition-transform"
      >
        <p className="text-sm font-black text-foreground">Challenge Holder</p>
        <p className="text-[10px] text-muted-foreground mt-1">{resolved ? "Zone resolved" : "Push fan momentum"}</p>
      </button>
      <p className="text-[10px] text-muted-foreground mt-2">
        Your control: {you}% · Rival: {them}% · Time: {timeLeft}s
      </p>
      <p className="text-[10px] text-amber-300 mt-1">
        {resolved && you >= them ? "Zone captured: passive Fan Bond enabled (mock)." : "Regional points + streak bonus can apply."}
      </p>
    </div>
  );
}

/* ── Rival Pitch: Launches Compete ChallengeFlow ───────────────────────── */
function RivalPitchActivity({ onComplete }: { onComplete: (score: number) => void }) {
  const { activePlayer, playersById } = useGameProgress();
  const [selectedRival, setSelectedRival] = useState<number | null>(null);
  const [moves, setMoves] = useState<Array<"Press" | "Dribble" | "Shoot" | "Defend" | "Counter" | "Hold Possession">>([]);
  const [resolved, setResolved] = useState<null | "win" | "lose" | "draw">(null);
  const rivals = mockRivals.slice(0, 3);

  const movePool: Array<"Press" | "Dribble" | "Shoot" | "Defend" | "Counter" | "Hold Possession"> = [
    "Press", "Dribble", "Shoot", "Defend", "Counter", "Hold Possession",
  ];

  const beats = (a: typeof movePool[number], b: typeof movePool[number]) => {
    if (a === "Dribble" && b === "Press") return 1;
    if (a === "Press" && b === "Hold Possession") return 1;
    if (a === "Counter" && b === "Press") return 1;
    if (a === "Defend" && b === "Shoot") return 1;
    if (a === b) return 0;
    return -1;
  };

  const resolve = () => {
    if (selectedRival === null || moves.length < 3) return;
    const rivalMoves = [0, 1, 2].map(() => movePool[Math.floor(Math.random() * movePool.length)]!);
    let score = 0;
    for (let i = 0; i < 3; i += 1) {
      score += beats(moves[i]!, rivalMoves[i]!);
    }
    const conf = activePlayer.attributes.confidence;
    const form = activePlayer.attributes.form;
    const morale = activePlayer.attributes.morale;
    const fanBond = activePlayer.attributes.fanBond;
    // Lightweight attribute influence on duel resolution
    score += (form + conf) >= 140 ? 1 : 0; // better execution for Shoot phases
    score += morale >= 70 && moves.includes("Hold Possession") ? 1 : 0;
    score += fanBond >= 70 ? 1 : 0;
    const outcome: "win" | "lose" | "draw" = score >= 2 ? "win" : score <= -1 ? "lose" : "draw";
    setResolved(outcome);
    onComplete(outcome === "win" ? 6 : outcome === "draw" ? 4 : 2);
  };

  if (selectedRival !== null && resolved === null && moves.length >= 3) {
    return (
      <div className="py-3 space-y-3">
        <p className="text-xs font-black text-foreground">3-Move Tactical Duel</p>
        <p className="text-[10px] text-muted-foreground">Moves locked: {moves.join(" · ")}</p>
        <button
          type="button"
          onClick={resolve}
          className="w-full py-3 rounded-2xl bg-red-500/15 border border-red-500/30 text-xs font-black text-foreground"
        >
          Resolve Duel
        </button>
      </div>
    );
  }

  if (selectedRival !== null && resolved !== null) {
    return (
      <div className="py-4 text-center">
        <p className="text-sm font-black text-foreground mb-1">
          {resolved === "win" ? "Duel Won" : resolved === "draw" ? "Duel Draw" : "Duel Lost"}
        </p>
        <p className="text-[10px] text-muted-foreground">Confidence + XP + points resolved (mock leaderboard impact).</p>
      </div>
    );
  }

  if (selectedRival !== null && moves.length < 3) {
    const rival = rivals[selectedRival];
    const rivalPlayer = playersById[rival.signaturePlayerId] ?? getPlayerById(rival.signaturePlayerId);
    if (rivalPlayer) {
      return (
        <div className="py-3 space-y-2">
          <p className="text-xs font-black text-foreground">Pick 3 moves vs @{rival.name}</p>
          <div className="grid grid-cols-2 gap-2">
            {movePool.map((m) => (
              <button
                key={m}
                type="button"
                disabled={moves.length >= 3}
                onClick={() => setMoves((prev) => [...prev, m])}
                className="p-2 rounded-xl bg-red-500/5 border border-red-500/10 text-[10px] font-bold text-foreground active:scale-[0.98]"
              >
                {m}
              </button>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">Selected: {moves.join(" · ") || "None yet"}</p>
        </div>
      );
    }
  }

  return (
    <div className="py-3 space-y-2">
      <p className="text-xs font-black text-foreground mb-2">Choose your rival</p>
      {rivals.map((rival, i) => {
        const rp = playersById[rival.signaturePlayerId] ?? getPlayerById(rival.signaturePlayerId);
        if (!rp) return null;
        return (
          <button
            key={rival.id}
            type="button"
            onClick={() => setSelectedRival(i)}
            className="w-full flex items-center gap-3 p-3 rounded-2xl bg-red-500/5 border border-red-500/10 hover:bg-red-500/10 transition-colors active:scale-[0.98]"
          >
            <AnimatedPortrait player={rp} size="xs" />
            <div className="flex-1 min-w-0 text-left">
              <p className="text-xs font-black text-foreground truncate">{rp.name}</p>
              <p className="text-[10px] text-muted-foreground">
                {rp.position} · OVR {rp.stats.overall} · @{rival.name}
              </p>
            </div>
            <Swords className="w-4 h-4 text-red-400 shrink-0" />
          </button>
        );
      })}
    </div>
  );
}

/* ── Pressure Zone: Reaction Speed Test ────────────────────────────────── */
function PressureActivity({ onComplete }: { onComplete: (score: number) => void }) {
  const scenarios = [
    "Final penalty",
    "Last-minute counterattack",
    "Must-win header",
    "Mistake recovery",
    "Final defensive stand",
    "Calm the crowd after a bad touch",
  ];
  const options = ["Go aggressive", "Stay composed", "Play safe", "Trust instinct"] as const;
  const [scenario] = useState(scenarios[Math.floor(Math.random() * scenarios.length)]!);
  const [picked, setPicked] = useState<string | null>(null);
  const { activePlayer } = useGameProgress();

  const choose = (choice: string) => {
    if (picked) return;
    setPicked(choice);
    const conf = activePlayer.attributes.confidence;
    const form = activePlayer.attributes.form;
    const morale = activePlayer.attributes.morale;
    const base =
      choice === "Stay composed" ? morale :
      choice === "Go aggressive" ? conf :
      choice === "Trust instinct" ? Math.round((conf + form) / 2) :
      Math.round((morale + form) / 2);
    onComplete(base >= 75 ? 6 : base >= 60 ? 4 : 2);
  };

  return (
    <div className="py-4">
      <p className="text-xs font-black text-foreground">Clutch Moment Challenge</p>
      <p className="text-[10px] text-muted-foreground mb-3">Scenario: {scenario}</p>
      <div className="grid grid-cols-2 gap-2">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            disabled={Boolean(picked)}
            onClick={() => choose(o)}
            className="p-2.5 rounded-xl border border-violet-500/20 bg-violet-500/10 text-[10px] font-bold text-foreground active:scale-[0.98]"
          >
            {o}
          </button>
        ))}
      </div>
      {picked && (
        <div className="mt-3 p-2 rounded-xl bg-violet-500/10 border border-violet-500/20">
          <p className="text-[10px] text-foreground font-bold">Chosen: {picked}</p>
          <p className="text-[10px] text-muted-foreground">Confidence + XP + FP resolved.</p>
        </div>
      )}
    </div>
  );
}

/* ── Stadium Zone: Event Collect ───────────────────────────────────────── */
function StadiumActivity({ onComplete }: { onComplete: (score: number) => void }) {
  const { ownedPlayers, activePlayer } = useGameProgress();
  const [captainId, setCaptainId] = useState<string>(activePlayer.id);
  const [attackerId, setAttackerId] = useState<string>(ownedPlayers[1]?.id ?? activePlayer.id);
  const [defenderId, setDefenderId] = useState<string>(ownedPlayers[2]?.id ?? activePlayer.id);
  const [resolved, setResolved] = useState(false);
  const roster = ownedPlayers.slice(0, 8);

  const resolve = () => {
    if (resolved) return;
    const pick = (id: string) => roster.find((p) => p.id === id) ?? activePlayer;
    const c = pick(captainId);
    const a = pick(attackerId);
    const d = pick(defenderId);
    const avgOverall = Math.round((c.stats.overall + a.stats.overall + d.stats.overall) / 3);
    const rarityBoost = [c, a, d].filter((p) => p.rarity === "legendary").length * 4;
    const evoBoost = c.evolutionStage + a.evolutionStage + d.evolutionStage;
    const score = avgOverall + rarityBoost + evoBoost;
    setResolved(true);
    onComplete(score >= 88 ? 6 : score >= 75 ? 4 : 2);
  };

  return (
    <div className="py-4">
      <p className="text-xs font-black text-foreground mb-1">Squad Power Clash</p>
      <p className="text-[10px] text-muted-foreground mb-3">Opening Pressure · Key Duel · Final Moment</p>
      <div className="space-y-2">
        <select value={captainId} onChange={(e) => setCaptainId(e.target.value)} className="w-full p-2 rounded-xl bg-background/40 border border-border/30 text-xs">
          {roster.map((p) => <option key={`c-${p.id}`} value={p.id}>Captain: {p.name}</option>)}
        </select>
        <select value={attackerId} onChange={(e) => setAttackerId(e.target.value)} className="w-full p-2 rounded-xl bg-background/40 border border-border/30 text-xs">
          {roster.map((p) => <option key={`a-${p.id}`} value={p.id}>Attacker: {p.name}</option>)}
        </select>
        <select value={defenderId} onChange={(e) => setDefenderId(e.target.value)} className="w-full p-2 rounded-xl bg-background/40 border border-border/30 text-xs">
          {roster.map((p) => <option key={`d-${p.id}`} value={p.id}>Defender: {p.name}</option>)}
        </select>
      </div>
      <button
        type="button"
        onClick={resolve}
        disabled={resolved}
        className="w-full mt-3 py-3 rounded-2xl bg-yellow-500/15 border border-yellow-500/30 text-xs font-black text-foreground active:scale-[0.98]"
      >
        Resolve Squad Clash
      </button>
      <p className="text-[10px] text-muted-foreground mt-2">
        Rewards: event points + XP + stat gain {resolved ? "· rare encounter chance checked (mock)." : ""}
      </p>
    </div>
  );
}

/* ── Main ZoneExperience component ─────────────────────────────────────── */
const ZoneExperience = ({ zone, onClose }: ZoneExperienceProps) => {
  const [step, setStep] = useState<ZoneStep>("intro");
  const [activityScore, setActivityScore] = useState(0);
  const [trainingMeta, setTrainingMeta] = useState<TrainingTriviaMeta | null>(null);
  const { activePlayer, addXp, applyAttributeDelta, addFocusPoints } = useGameProgress();
  const config = zoneConfig[zone.type];
  const Icon = config.icon;

  const handleActivityComplete = useCallback(
    (score: number, meta?: TrainingTriviaMeta) => {
      setActivityScore(score);
      if (zone.type === "training") setTrainingMeta(meta ?? null);
      // Apply scaled rewards based on performance
      const trainingEffectiveScore =
        zone.type === "training" ? score + (meta?.streakBonus ?? 0) : score;
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
      case "recovery": return <RecoveryActivity onComplete={handleActivityComplete} />;
      case "fan-arena": return <FanArenaActivity onComplete={handleActivityComplete} />;
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
    if (zone.type === "recovery") return `${activityScore} breathing cycles`;
    if (zone.type === "fan-arena") return `${activityScore} taps — ${activityScore >= 15 ? "Epic Hype!" : "Nice effort!"}`;
    if (zone.type === "pressure") return `${activityScore}/3 reactions caught`;
    if (zone.type === "stadium") return `${activityScore} event rewards`;
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
  const finalXp = Math.round(config.xp * mult);
  const finalAttr = Math.max(1, Math.round(config.attrGain * mult));

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

              <div className="flex gap-2 justify-center mb-5">
                {[
                  { label: `+${finalAttr} ${config.attribute.charAt(0).toUpperCase() + config.attribute.slice(1)}`, icon: "📈" },
                  { label: `+${finalXp} XP`, icon: "⭐" },
                  { label: `+${config.fpGain} FP`, icon: "🎯" },
                ].map((r) => (
                  <div key={r.label} className={`px-3 py-2 rounded-xl ${config.bgAccent} ring-1 ${config.ringColor}`}>
                    <span className="text-sm">{r.icon}</span>
                    <p className="text-[10px] font-bold text-foreground mt-0.5">{r.label}</p>
                  </div>
                ))}
              </div>

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
