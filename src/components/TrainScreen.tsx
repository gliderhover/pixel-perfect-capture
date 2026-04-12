import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Heart, Flame, Shield, Sparkles } from "lucide-react";
import { useGameProgress } from "@/context/GameProgressContext";
import AnimatedPortrait from "./AnimatedPortrait";
import { cn } from "@/lib/utils";

type Chip = { label: string; val: string; positive?: boolean };

interface ChatMessage {
  id: number;
  from: "user" | "player";
  text: string;
  chips?: Chip[];
}

const zoneFlavor: Record<string, string> = {
  training: "Training Ground",
  recovery: "Recovery Center",
  "fan-arena": "Fan Arena",
  rival: "Rival Pitch",
  pressure: "Pressure Zone",
  stadium: "Stadium",
  mission: "Camera Mission",
};

const matchCopy: Record<string, string> = {
  idle: "Between matches",
  prematch: "Pre-match nerves",
  live: "Live — all eyes on us",
  halftime: "Halftime — regroup",
  postwin: "After the win",
  postloss: "Tough result — bounce back",
};

function moodLabel(
  attrs: { confidence: number; form: number; morale: number; fanBond: number },
  pulse: string,
  phase: string
) {
  const m = (attrs.confidence + attrs.morale) / 2;
  if (pulse === "goal") return "Electric";
  if (pulse === "injury") return "Fragile";
  if (phase === "postloss") return "Heavy";
  if (phase === "postwin") return "Buzzing";
  if (m >= 55) return "Locked in";
  if (m >= 40) return "Steady";
  return "Finding rhythm";
}

const TrainScreen = () => {
  const {
    activePlayer: player,
    explorationZoneType,
    matchPhase,
    livePulse,
    competitiveStreak,
    addXp,
    addBond,
    applyAttributeDelta,
  } = useGameProgress();

  const chatRef = useRef<HTMLDivElement>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");

  const zoneName = explorationZoneType ? zoneFlavor[explorationZoneType] : null;
  const mood = useMemo(
    () => moodLabel(player.attributes, livePulse, matchPhase),
    [player.attributes, livePulse, matchPhase]
  );

  useEffect(() => {
    const zoneHint = zoneName
      ? ` We're synced to ${zoneName} — ${
          explorationZoneType === "training"
            ? "drills on my mind."
            : explorationZoneType === "recovery"
              ? "legs are listening."
              : explorationZoneType === "rival"
                ? "I want this dub."
                : "feeling the noise."
        }`
      : "";
    const streakHint = competitiveStreak >= 3 ? " Love the run we're on." : "";
    setMessages([
      {
        id: 1,
        from: "player",
        text: `Coach — ${player.name} here. ${matchCopy[matchPhase] ?? matchCopy.idle}.${zoneHint}${streakHint}`,
        chips: [{ label: "Tip", val: "use quick actions", positive: true }],
      },
    ]);
  }, [player.id, player.name, matchPhase, explorationZoneType, zoneName, competitiveStreak]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const appendChat = (userText: string, playerText: string, chips: Chip[]) => {
    const uid = Date.now();
    setMessages((prev) => [
      ...prev,
      { id: uid, from: "user", text: userText },
      { id: uid + 1, from: "player", text: playerText, chips },
    ]);
  };

  const sendTrainingChoice = (kind: "motivate" | "challenge" | "comfort" | "tactics" | "recovery") => {
    const z = explorationZoneType;
    if (kind === "motivate") {
      applyAttributeDelta(player.id, { morale: 2, confidence: 1 });
      addBond(player.id, 2);
      addXp(player.id, 8);
      appendChat(
        "Motivate me for the next step.",
        z === "rival"
          ? "I'm hunting that win — give me the next duel."
          : "You believing in me flips a switch. Let's go.",
        [
          { label: "Morale", val: "+2", positive: true },
          { label: "Confidence", val: "+1", positive: true },
          { label: "Bond", val: "+2", positive: true },
          { label: "XP", val: "+8", positive: true },
        ]
      );
      return;
    }
    if (kind === "challenge") {
      applyAttributeDelta(player.id, { confidence: 2, form: 1 });
      addBond(player.id, 1);
      addXp(player.id, 10);
      appendChat(
        "Challenge me — be honest.",
        "Alright coach, hit me with the hard truth. I'll answer with work.",
        [
          { label: "Confidence", val: "+2", positive: true },
          { label: "Form", val: "+1", positive: true },
          { label: "Bond", val: "+1", positive: true },
          { label: "XP", val: "+10", positive: true },
        ]
      );
      return;
    }
    if (kind === "comfort") {
      applyAttributeDelta(player.id, { morale: 3, fanBond: 1 });
      addBond(player.id, 3);
      addXp(player.id, 6);
      appendChat(
        "I need calm today.",
        matchPhase === "postloss"
          ? "That one stung. Stay with me — we'll turn it into fuel."
          : "I've got you. Breathe, reset, next play.",
        [
          { label: "Morale", val: "+3", positive: true },
          { label: "Fan bond", val: "+1", positive: true },
          { label: "Bond", val: "+3", positive: true },
          { label: "XP", val: "+6", positive: true },
        ]
      );
      return;
    }
    if (kind === "tactics") {
      applyAttributeDelta(player.id, { form: 2, confidence: 1 });
      addXp(player.id, 9);
      addBond(player.id, 1);
      appendChat(
        "Talk tactics — what should I fix?",
        z === "training"
          ? "Patterns and presses — sharpen the first touch under pressure."
          : "Shape, timing, runs — keep the plan clean.",
        [
          { label: "Form", val: "+2", positive: true },
          { label: "Confidence", val: "+1", positive: true },
          { label: "XP", val: "+9", positive: true },
        ]
      );
      return;
    }
    applyAttributeDelta(player.id, { morale: 2, form: 1 });
    addXp(player.id, 7);
    addBond(player.id, 2);
    appendChat(
      "Recovery first.",
      z === "recovery"
        ? "Body's talking — rest, hydrate, mindset follows."
        : "Smart. We reload so the next sprint hits harder.",
      [
        { label: "Morale", val: "+2", positive: true },
        { label: "Form", val: "+1", positive: true },
        { label: "XP", val: "+7", positive: true },
        { label: "Bond", val: "+2", positive: true },
      ]
    );
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const uid = Date.now();
    const lower = text.toLowerCase();
    let reply = "Copy — I'm taking that into the next session.";
    let chips: Chip[] = [
      { label: "Morale", val: "+1", positive: true },
      { label: "XP", val: "+5", positive: true },
      { label: "Bond", val: "+1", positive: true },
    ];

    if (lower.includes("conf")) {
      reply = "Confidence is a dial — we turn it slowly, then snap it forward.";
      applyAttributeDelta(player.id, { confidence: 2 });
      addXp(player.id, 6);
      addBond(player.id, 1);
      chips = [
        { label: "Confidence", val: "+2", positive: true },
        { label: "XP", val: "+6", positive: true },
        { label: "Bond", val: "+1", positive: true },
      ];
    } else if (lower.includes("fan") || lower.includes("bond")) {
      reply =
        player.bondTrust > 40
          ? "You know me better now — I'll open up more in big moments."
          : "Every message builds trust. Keep showing up.";
      applyAttributeDelta(player.id, { fanBond: 2 });
      addXp(player.id, 5);
      addBond(player.id, 2);
      chips = [
        { label: "Fan bond", val: "+2", positive: true },
        { label: "Bond", val: "+2", positive: true },
        { label: "XP", val: "+5", positive: true },
      ];
    } else if (lower.includes("morale")) {
      applyAttributeDelta(player.id, { morale: 2 });
      addXp(player.id, 5);
      addBond(player.id, 1);
      reply = "That lands. Morale up — I feel lighter.";
      chips = [
        { label: "Morale", val: "+2", positive: true },
        { label: "XP", val: "+5", positive: true },
        { label: "Bond", val: "+1", positive: true },
      ];
    } else {
      applyAttributeDelta(player.id, { morale: 1 });
      addXp(player.id, 5);
      addBond(player.id, 1);
    }

    setMessages((prev) => [
      ...prev,
      { id: uid, from: "user", text },
      { id: uid + 1, from: "player", text: reply, chips },
    ]);
    setInput("");
  };

  const suggested = useMemo(() => {
    const base = ["Check my confidence", "Prep for rivalry", "How's the body?"];
    if (explorationZoneType === "recovery") return ["Recovery mindset", "Sleep & legs", ...base];
    if (explorationZoneType === "rival") return ["Rivalry headspace", "Lock in mentally", ...base];
    if (matchPhase === "postloss") return ["Bounce-back plan", "What went wrong?", ...base];
    return base;
  }, [explorationZoneType, matchPhase]);

  const bondPct = Math.min(100, player.bondTrust);
  const xpPct = Math.min(100, (player.currentXp / player.xpToNext) * 100);

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col safe-page-bottom with-sidebar-pad pt-3 pr-4">
      <div className="mb-2 space-y-2 px-0">
        <div className="glass-card-strong rounded-2xl p-3">
          <div className="flex items-start gap-3">
            <AnimatedPortrait player={player} size="md" showMood />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-black text-foreground">{player.name}</p>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-black text-primary">
                  Lv {player.level}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                  {mood}
                </span>
              </div>
              <p className="truncate text-[10px] text-muted-foreground">
                {player.position} · {player.representedCountry} · {player.clubTeam}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
              <p className="mt-1 text-[9px] text-muted-foreground">
                XP {player.currentXp}/{player.xpToNext} · Evolution {player.evolutionStage + 1}/4
              </p>
              <div className="mt-2 flex items-center gap-2">
                <Heart className="h-3.5 w-3.5 shrink-0 text-accent" />
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-accent/80 to-accent"
                    style={{ width: `${bondPct}%` }}
                  />
                </div>
                <span className="text-[9px] font-black text-accent">Trust {bondPct}</span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {zoneName && (
                  <span className="rounded-lg border border-primary/25 bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
                    Zone: {zoneName}
                  </span>
                )}
                <span className="rounded-lg border border-border/40 bg-muted/40 px-2 py-0.5 text-[9px] font-semibold text-muted-foreground">
                  {matchCopy[matchPhase] ?? matchCopy.idle}
                </span>
                {competitiveStreak >= 2 && (
                  <span className="rounded-lg border border-accent/30 bg-accent/10 px-2 py-0.5 text-[9px] font-bold text-accent">
                    Streak {competitiveStreak}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {(
            [
              ["motivate", "Motivate", Sparkles],
              ["challenge", "Challenge", Flame],
              ["comfort", "Comfort", Heart],
              ["tactics", "Tactics", Shield],
              ["recovery", "Recovery", Heart],
            ] as const
          ).map(([key, label, Icon]) => (
            <button
              key={key}
              type="button"
              onClick={() => sendTrainingChoice(key)}
              className="flex items-center gap-1 rounded-xl border border-border/40 bg-card/50 px-2.5 py-1.5 text-[10px] font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10"
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div ref={chatRef} className="flex-1 space-y-3 overflow-y-auto px-0">
        {messages.map((msg) => (
          <div key={msg.id} className={`flex animate-fade-in-up ${msg.from === "user" ? "justify-end" : "justify-start"}`}>
            <div className="max-w-[88%]">
              <div
                className={`px-4 py-2.5 text-sm ${
                  msg.from === "user"
                    ? "rounded-2xl rounded-br-md bg-primary text-primary-foreground"
                    : "glass-card rounded-2xl rounded-bl-md text-foreground"
                }`}
              >
                {msg.text}
              </div>
              {msg.chips && msg.chips.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-1">
                  {msg.chips.map((c, i) => (
                    <span
                      key={i}
                      className={cn(
                        "rounded-full px-2 py-0.5 text-[9px] font-black",
                        c.positive === false ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                      )}
                    >
                      {c.label} {c.val}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="py-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {suggested.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => sendMessage(prompt)}
              className="shrink-0 rounded-xl border border-border/30 bg-card/40 px-3 py-2 text-xs font-semibold text-foreground/90 transition-all hover:border-primary/35 active:scale-95"
            >
              {prompt}
            </button>
          ))}
        </div>
      </div>

      <div className="pb-2">
        <div className="glass-card-strong flex items-center gap-2 rounded-2xl p-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            placeholder="Message your player..."
            className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-emerald-400 floating-button"
          >
            <Send className="h-4 w-4 text-primary-foreground" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrainScreen;
