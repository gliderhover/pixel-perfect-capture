import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Heart, Flame, Shield, Sparkles } from "lucide-react";
import { useGameProgress } from "@/context/GameProgressContext";
import AnimatedPortrait from "./AnimatedPortrait";
import { cn } from "@/lib/utils";
import { applyCultivation, sendPlayerChat, trainUserPlayer } from "@/lib/apiService";

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
    userId,
    activePlayer: player,
    explorationZoneType,
    matchPhase,
    livePulse,
    competitiveStreak,
    refreshOwnedPlayers,
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

  const trainViaApi = async (
    mode: "balanced" | "confidence" | "form" | "morale" | "bond",
    userText: string,
    playerText: string
  ) => {
    try {
      const result = await trainUserPlayer(userId, player.id, mode);
      await refreshOwnedPlayers();
      const chips: Chip[] = [{ label: "XP", val: `+${result.xpGained}`, positive: true }];
      if (result.delta.confidence) chips.push({ label: "Confidence", val: `+${result.delta.confidence}`, positive: true });
      if (result.delta.form) chips.push({ label: "Form", val: `+${result.delta.form}`, positive: true });
      if (result.delta.morale) chips.push({ label: "Morale", val: `+${result.delta.morale}`, positive: true });
      if (result.delta.fanBond) chips.push({ label: "Fan bond", val: `+${result.delta.fanBond}`, positive: true });
      appendChat(userText, playerText, chips);
    } catch (error) {
      appendChat(userText, "Can't lock in the training update right now. Try again in a second.", [
        {
          label: "Error",
          val: error instanceof Error ? error.message : "training failed",
          positive: false,
        },
      ]);
    }
  };

  const sendTrainingChoice = (kind: "motivate" | "challenge" | "comfort" | "tactics" | "recovery") => {
    const z = explorationZoneType;
    if (kind === "motivate") {
      void trainViaApi(
        "balanced",
        "Motivate me for the next step.",
        z === "rival"
          ? "I'm hunting that win — give me the next duel."
          : "You believing in me flips a switch. Let's go."
      );
      return;
    }
    if (kind === "challenge") {
      void trainViaApi(
        "confidence",
        "Challenge me — be honest.",
        "Alright coach, hit me with the hard truth. I'll answer with work."
      );
      return;
    }
    if (kind === "comfort") {
      void trainViaApi(
        "morale",
        "I need calm today.",
        matchPhase === "postloss"
          ? "That one stung. Stay with me — we'll turn it into fuel."
          : "I've got you. Breathe, reset, next play."
      );
      return;
    }
    if (kind === "tactics") {
      void trainViaApi(
        "form",
        "Talk tactics — what should I fix?",
        z === "training"
          ? "Patterns and presses — sharpen the first touch under pressure."
          : "Shape, timing, runs — keep the plan clean."
      );
      return;
    }
    void trainViaApi(
      "bond",
      "Recovery first.",
      z === "recovery"
        ? "Body's talking — rest, hydrate, mindset follows."
        : "Smart. We reload so the next sprint hits harder."
    );
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    const run = async () => {
      try {
        const history = messages
          .slice(-6)
          .map((m) => ({
            role: m.from === "user" ? "user" : "assistant",
            content: m.text,
          })) as { role: "user" | "assistant"; content: string }[];

        const chat = await sendPlayerChat({
          playerId: player.id,
          message: text,
          state: {
            confidence: player.attributes.confidence,
            form: player.attributes.form,
            morale: player.attributes.morale,
            fanBond: player.attributes.fanBond,
          },
          history,
        });
        await applyCultivation({
          userId,
          playerId: player.id,
          attributeDeltas: chat.attributeDeltas,
          xpGain: 6,
        });
        await refreshOwnedPlayers();

        appendChat(text, chat.reply, [
          { label: "XP", val: "+6", positive: true },
          { label: "Confidence", val: `${chat.attributeDeltas.confidence >= 0 ? "+" : ""}${chat.attributeDeltas.confidence}`, positive: chat.attributeDeltas.confidence >= 0 },
          { label: "Form", val: `${chat.attributeDeltas.form >= 0 ? "+" : ""}${chat.attributeDeltas.form}`, positive: chat.attributeDeltas.form >= 0 },
          { label: "Morale", val: `${chat.attributeDeltas.morale >= 0 ? "+" : ""}${chat.attributeDeltas.morale}`, positive: chat.attributeDeltas.morale >= 0 },
          { label: "Fan bond", val: `${chat.attributeDeltas.fanBond >= 0 ? "+" : ""}${chat.attributeDeltas.fanBond}`, positive: chat.attributeDeltas.fanBond >= 0 },
        ]);
      } catch (error) {
        appendChat(text, "Connection dropped. I couldn't process that message yet.", [
          { label: "Error", val: error instanceof Error ? error.message : "chat failed", positive: false },
        ]);
      }
    };
    void run();
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
