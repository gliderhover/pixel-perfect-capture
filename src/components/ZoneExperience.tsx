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
    purpose: "Restore morale and focus before the next challenge",
    cta: "Start Recovery",
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
    purpose: "Build stronger fan connection and earn support bonuses",
    cta: "Hype the Crowd",
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
    purpose: "Face nearby rivals and prove your squad strength",
    cta: "View Rivals",
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
    purpose: "Face pressure and build confidence under stress",
    cta: "Enter Pressure Test",
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
    purpose: "Tap into live match energy and special event bonuses",
    cta: "Join Event",
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
        const result = await fetchTrainingTriviaSession(10, `${Date.now()}-${Math.random()}`);
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
  const [phase, setPhase] = useState<"inhale" | "hold" | "exhale">("inhale");
  const [cycle, setCycle] = useState(0);
  const [scale, setScale] = useState(1);
  const totalCycles = 3;
  const phaseMs = { inhale: 2000, hold: 1500, exhale: 2000 };

  useEffect(() => {
    if (cycle >= totalCycles) { onComplete(totalCycles); return; }
    const seq: ("inhale" | "hold" | "exhale")[] = ["inhale", "hold", "exhale"];
    let i = 0;
    setPhase(seq[0]);
    setScale(1.3);

    const advance = () => {
      i++;
      if (i >= seq.length) {
        setCycle((c) => c + 1);
        return;
      }
      setPhase(seq[i]);
      setScale(seq[i] === "inhale" ? 1.3 : seq[i] === "hold" ? 1.3 : 1);
    };
    const t1 = setTimeout(advance, phaseMs.inhale);
    const t2 = setTimeout(advance, phaseMs.inhale + phaseMs.hold);
    const t3 = setTimeout(advance, phaseMs.inhale + phaseMs.hold + phaseMs.exhale);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [cycle, totalCycles, onComplete]);

  const phaseLabel = { inhale: "Breathe In", hold: "Hold", exhale: "Breathe Out" };

  return (
    <div className="py-6 flex flex-col items-center">
      <div className="flex gap-1.5 mb-4">
        {Array.from({ length: totalCycles }).map((_, i) => (
          <div key={i} className={`w-3 h-3 rounded-full transition-colors duration-500 ${
            i < cycle ? "bg-sky-400" : "bg-muted"
          }`} />
        ))}
      </div>
      <div className="relative w-32 h-32 flex items-center justify-center mb-4">
        <div
          className="absolute inset-0 rounded-full bg-sky-400/10 border border-sky-400/20 transition-transform duration-[2000ms] ease-in-out"
          style={{ transform: `scale(${scale})` }}
        />
        <div
          className="w-20 h-20 rounded-full bg-sky-500/20 border border-sky-400/30 flex items-center justify-center transition-transform duration-[2000ms] ease-in-out"
          style={{ transform: `scale(${scale})` }}
        >
          <Wind className="w-8 h-8 text-sky-400" />
        </div>
      </div>
      <p className="text-lg font-black text-foreground animate-fade-in" key={phase}>
        {phaseLabel[phase]}
      </p>
      <p className="text-[10px] text-muted-foreground mt-1">
        Cycle {Math.min(cycle + 1, totalCycles)} of {totalCycles}
      </p>
    </div>
  );
}

/* ── Fan Arena: Hype Meter Tap ─────────────────────────────────────────── */
function FanArenaActivity({ onComplete }: { onComplete: (score: number) => void }) {
  const [meter, setMeter] = useState(0);
  const [timeLeft, setTimeLeft] = useState(5);
  const [taps, setTaps] = useState(0);
  const target = 15;

  useEffect(() => {
    if (timeLeft <= 0) { onComplete(taps); return; }
    const t = setTimeout(() => setTimeLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [timeLeft, taps, onComplete]);

  useEffect(() => {
    // decay
    if (timeLeft <= 0) return;
    const d = setInterval(() => setMeter((m) => Math.max(0, m - 2)), 300);
    return () => clearInterval(d);
  }, [timeLeft]);

  const handleTap = () => {
    if (timeLeft <= 0) return;
    setTaps((t) => t + 1);
    setMeter((m) => Math.min(100, m + 8));
  };

  const pct = Math.min(100, meter);
  const filled = pct >= 80;

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs font-black text-foreground">Tap fast to hype the crowd!</p>
        <div className="flex items-center gap-1.5">
          <Timer className="w-3.5 h-3.5 text-muted-foreground" />
          <span className={`text-sm font-black ${timeLeft <= 2 ? "text-destructive" : "text-foreground"}`}>
            {timeLeft}s
          </span>
        </div>
      </div>

      {/* Hype meter */}
      <div className="h-4 bg-muted rounded-full overflow-hidden mb-4">
        <div
          className={`h-full rounded-full transition-all duration-150 ${
            filled ? "bg-gradient-to-r from-amber-400 to-orange-500 animate-pulse" : "bg-gradient-to-r from-amber-500/60 to-orange-400/60"
          }`}
          style={{ width: `${pct}%` }}
        />
      </div>

      <button
        type="button"
        onClick={handleTap}
        disabled={timeLeft <= 0}
        className={`w-full aspect-[2/1] rounded-2xl flex flex-col items-center justify-center gap-2 transition-all select-none active:scale-95 ${
          filled
            ? "bg-gradient-to-br from-amber-500/20 to-orange-600/20 border-2 border-amber-400/40"
            : "bg-amber-500/5 border border-amber-500/10"
        }`}
      >
        <span className="text-4xl">{filled ? "🔥" : "📣"}</span>
        <p className="text-sm font-black text-foreground">{taps} taps</p>
        {filled && <p className="text-[10px] text-amber-400 font-bold animate-pulse">MAX HYPE!</p>}
      </button>

      <p className="text-[10px] text-muted-foreground text-center mt-2">
        {taps >= target ? "🎉 Target reached!" : `Target: ${target} taps`}
      </p>
    </div>
  );
}

/* ── Rival Pitch: Launches Compete ChallengeFlow ───────────────────────── */
function RivalPitchActivity({ onComplete }: { onComplete: (score: number) => void }) {
  const { activePlayer, playersById } = useGameProgress();
  const [selectedRival, setSelectedRival] = useState<number | null>(null);
  const rivals = mockRivals.slice(0, 3);

  if (selectedRival !== null) {
    const rival = rivals[selectedRival];
    const rivalPlayer = playersById[rival.signaturePlayerId] ?? getPlayerById(rival.signaturePlayerId);
    if (rivalPlayer) {
      return (
        <ChallengeFlow
          rival={rival}
          rivalPlayer={rivalPlayer}
          onClose={() => { onComplete(1); }}
        />
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
  const [state, setState] = useState<"wait" | "ready" | "go" | "done">("wait");
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState<number[]>([]);
  const goTime = useRef(0);
  const totalRounds = 3;

  const startRound = useCallback(() => {
    setState("ready");
    const delay = 1500 + Math.random() * 2000;
    const t = setTimeout(() => {
      goTime.current = Date.now();
      setState("go");
    }, delay);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (round >= totalRounds) {
      onComplete(times.length);
      return;
    }
    if (state === "wait") {
      const t = setTimeout(() => startRound(), 500);
      return () => clearTimeout(t);
    }
  }, [round, state, totalRounds, times.length, onComplete, startRound]);

  const handleTap = () => {
    if (state === "ready") {
      // too early
      setState("wait");
      setRound((r) => r + 1);
    } else if (state === "go") {
      const rt = Date.now() - goTime.current;
      setTimes((t) => [...t, rt]);
      setState("wait");
      setRound((r) => r + 1);
    }
  };

  const bgClass =
    state === "ready" ? "bg-violet-900/30 border-violet-500/20" :
    state === "go" ? "bg-violet-500/20 border-violet-400/40" :
    "bg-violet-500/5 border-violet-500/10";

  return (
    <div className="py-4">
      <div className="flex items-center justify-between mb-3 px-1">
        <p className="text-xs font-black text-foreground">Reaction Test</p>
        <div className="flex gap-1.5">
          {Array.from({ length: totalRounds }).map((_, i) => (
            <div key={i} className={`w-2.5 h-2.5 rounded-full transition-colors ${
              i < times.length ? "bg-violet-400" :
              i < round ? "bg-destructive/40" : "bg-muted"
            }`} />
          ))}
        </div>
      </div>
      <button
        type="button"
        onClick={handleTap}
        disabled={state === "wait" || state === "done"}
        className={`w-full aspect-[3/2] rounded-2xl border flex flex-col items-center justify-center gap-3 transition-all select-none active:scale-[0.97] ${bgClass}`}
      >
        {state === "wait" && <p className="text-xs text-muted-foreground animate-pulse">Get ready…</p>}
        {state === "ready" && (
          <>
            <div className="w-10 h-10 rounded-full bg-violet-500/30 flex items-center justify-center">
              <Flame className="w-5 h-5 text-violet-400" />
            </div>
            <p className="text-xs font-bold text-violet-300">Wait for it…</p>
          </>
        )}
        {state === "go" && (
          <>
            <div className="w-14 h-14 rounded-full bg-violet-400/30 flex items-center justify-center animate-scale-in">
              <Zap className="w-7 h-7 text-violet-300" />
            </div>
            <p className="text-lg font-black text-violet-200 animate-pulse">TAP NOW!</p>
          </>
        )}
      </button>
      {times.length > 0 && (
        <div className="flex gap-2 mt-3 justify-center">
          {times.map((t, i) => (
            <div key={i} className="px-2.5 py-1 rounded-lg bg-violet-500/10 text-center">
              <p className="text-xs font-black text-foreground">{t}ms</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ── Stadium Zone: Event Collect ───────────────────────────────────────── */
function StadiumActivity({ onComplete }: { onComplete: (score: number) => void }) {
  const [collected, setCollected] = useState<number[]>([]);
  const events = [
    { id: 0, emoji: "⚡", label: "Energy Surge", desc: "+XP Boost", color: "amber" },
    { id: 1, emoji: "🎯", label: "Scout Bonus", desc: "+Encounter Chance", color: "yellow" },
    { id: 2, emoji: "🛡️", label: "Shield Buff", desc: "+Morale Guard", color: "amber" },
    { id: 3, emoji: "🌟", label: "Star Moment", desc: "+All Stats", color: "yellow" },
  ];

  useEffect(() => {
    if (collected.length >= events.length) {
      const t = setTimeout(() => onComplete(collected.length), 500);
      return () => clearTimeout(t);
    }
  }, [collected, events.length, onComplete]);

  const handleCollect = (id: number) => {
    if (collected.includes(id)) return;
    setCollected((c) => [...c, id]);
  };

  return (
    <div className="py-4">
      <p className="text-xs font-black text-foreground mb-1">Stadium Event Rewards</p>
      <p className="text-[10px] text-muted-foreground mb-3">Tap each reward to collect</p>
      <div className="grid grid-cols-2 gap-2">
        {events.map((ev) => {
          const done = collected.includes(ev.id);
          return (
            <button
              key={ev.id}
              type="button"
              onClick={() => handleCollect(ev.id)}
              disabled={done}
              className={`p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all select-none active:scale-95 ${
                done
                  ? "bg-yellow-500/10 border-yellow-500/20 opacity-60"
                  : "bg-yellow-500/5 border-yellow-500/10 hover:bg-yellow-500/10"
              }`}
            >
              <span className={`text-2xl ${done ? "" : "animate-pulse"}`}>
                {done ? "✅" : ev.emoji}
              </span>
              <p className="text-[11px] font-black text-foreground">{ev.label}</p>
              <p className="text-[9px] text-muted-foreground">{ev.desc}</p>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] text-muted-foreground text-center mt-3">
        {collected.length}/{events.length} collected
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
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))", maxHeight: "90dvh" }}
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
        <div className="px-5 pb-4 overflow-y-auto" style={{ maxHeight: "calc(85dvh - 5rem)" }}>
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
