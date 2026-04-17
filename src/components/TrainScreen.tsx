import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Heart, Flame, Shield, Sparkles } from "lucide-react";
import { useGameProgress } from "@/context/GameProgressContext";
import AnimatedPortrait from "./AnimatedPortrait";
import { cn } from "@/lib/utils";
import { applyCultivation, fetchZoneFlavor, sendPlayerChat, trainUserPlayer } from "@/lib/apiService";

type Chip = { label: string; val: string; positive?: boolean };

interface ChatMessage {
  id: number;
  from: "user" | "player";
  text: string;
  chips?: Chip[];
}
type ChatThreadState = Record<string, ChatMessage[]>;
type TextByPlayerState = Record<string, string | null>;
type SuggestionsByPlayerState = Record<string, string[]>;

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
    playersById,
    ownedPlayersById,
    explorationZoneType,
    matchPhase,
    livePulse,
    competitiveStreak,
    refreshOwnedPlayers,
  } = useGameProgress();

  const chatRef = useRef<HTMLDivElement>(null);
  const [activeChatPlayerId, setActiveChatPlayerId] = useState<string | null>(null);
  const [messagesByPlayerId, setMessagesByPlayerId] = useState<ChatThreadState>({});
  const [input, setInput] = useState("");
  const [zoneFlavorText, setZoneFlavorText] = useState<string | null>(null);
  const [aiMoodLabelByPlayerId, setAiMoodLabelByPlayerId] = useState<TextByPlayerState>({});
  const [contextualSuggestedByPlayerId, setContextualSuggestedByPlayerId] = useState<SuggestionsByPlayerState>({});
  const [compactSwitcher, setCompactSwitcher] = useState(false);

  const zoneName = explorationZoneType ? zoneFlavor[explorationZoneType] : null;
  const ownedIds = useMemo(() => Object.keys(ownedPlayersById), [ownedPlayersById]);
  const chatCandidates = useMemo(
    () =>
      ownedIds
        .map((id) => playersById[id])
        .filter((p): p is typeof player => Boolean(p)),
    [ownedIds, playersById, player]
  );
  const fallbackPlayer = chatCandidates[0] ?? player;
  const activeChatPlayer =
    chatCandidates.find((p) => p.id === activeChatPlayerId) ?? fallbackPlayer;
  const currentPlayerId = activeChatPlayer.id;
  const messages = messagesByPlayerId[currentPlayerId] ?? [];
  const aiMoodLabel = aiMoodLabelByPlayerId[currentPlayerId] ?? null;
  const contextualSuggested = contextualSuggestedByPlayerId[currentPlayerId] ?? [];
  const mood = useMemo(
    () => moodLabel(activeChatPlayer.attributes, livePulse, matchPhase),
    [activeChatPlayer.attributes, livePulse, matchPhase]
  );

  useEffect(() => {
    if (chatCandidates.length === 0) {
      setActiveChatPlayerId(null);
      return;
    }
    if (!activeChatPlayerId || !chatCandidates.some((p) => p.id === activeChatPlayerId)) {
      setActiveChatPlayerId(chatCandidates[0]!.id);
    }
  }, [chatCandidates, activeChatPlayerId]);

  useEffect(() => {
    let cancelled = false;
    const loadFlavor = async () => {
      if (!explorationZoneType || !zoneName) {
        setZoneFlavorText(null);
        return;
      }
      try {
        const response = await fetchZoneFlavor(explorationZoneType, zoneName);
        if (!cancelled) setZoneFlavorText(response.flavor);
      } catch {
        if (!cancelled) setZoneFlavorText(null);
      }
    };
    void loadFlavor();
    return () => {
      cancelled = true;
    };
  }, [explorationZoneType, zoneName]);

  useEffect(() => {
    if (!currentPlayerId) return;
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
    const aiHint = zoneFlavorText ? ` ${zoneFlavorText}` : "";
    setMessagesByPlayerId((prev) => {
      if (prev[currentPlayerId]?.length) return prev;
      return {
        ...prev,
        [currentPlayerId]: [
          {
            id: 1,
            from: "player",
            text: `Coach — ${activeChatPlayer.name} here. ${matchCopy[matchPhase] ?? matchCopy.idle}.${zoneHint}${streakHint}${aiHint}`,
            chips: [{ label: "Tip", val: "use quick actions", positive: true }],
          },
        ],
      };
    });
    setAiMoodLabelByPlayerId((prev) => ({ ...prev, [currentPlayerId]: prev[currentPlayerId] ?? null }));
    setContextualSuggestedByPlayerId((prev) => ({ ...prev, [currentPlayerId]: prev[currentPlayerId] ?? [] }));
  }, [
    currentPlayerId,
    activeChatPlayer.name,
    matchPhase,
    explorationZoneType,
    zoneName,
    competitiveStreak,
    zoneFlavorText,
  ]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const appendChat = (userText: string, playerText: string, chips: Chip[]) => {
    const uid = Date.now();
    setMessagesByPlayerId((prev) => ({
      ...prev,
      [currentPlayerId]: [
        ...(prev[currentPlayerId] ?? []),
        { id: uid, from: "user", text: userText },
        { id: uid + 1, from: "player", text: playerText, chips },
      ],
    }));
  };

  const trainViaApi = async (
    mode: "balanced" | "confidence" | "form" | "morale" | "bond",
    userText: string,
    playerText: string
  ) => {
    try {
      const result = await trainUserPlayer(userId, activeChatPlayer.id, mode);
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
          playerId: activeChatPlayer.id,
          message: text,
          state: {
            confidence: activeChatPlayer.attributes.confidence,
            form: activeChatPlayer.attributes.form,
            morale: activeChatPlayer.attributes.morale,
            fanBond: activeChatPlayer.attributes.fanBond,
          },
          history,
          context: {
            zoneType: explorationZoneType ?? undefined,
            matchPhase,
            livePulse,
            competitiveStreak,
            liveEventTitle: zoneFlavorText ?? undefined,
            trainingPhase: explorationZoneType === "training" ? "skill-drill" : "dialogue",
            trustBond: activeChatPlayer.bondTrust,
            level: activeChatPlayer.level,
            evolutionStage: activeChatPlayer.evolutionStage,
            recentDuelResult: livePulse === "goal" ? "goal" : "none",
            recentTrainingOutcome: explorationZoneType === "training" ? "average" : "none",
            injuryState: explorationZoneType === "recovery" ? "recovering" : "none",
            justRecruited: false,
          },
        });
        await applyCultivation({
          userId,
          playerId: activeChatPlayer.id,
          attributeDeltas: chat.attributeDeltas,
          xpGain: 6,
        });
        await refreshOwnedPlayers();

        setAiMoodLabelByPlayerId((prev) => ({ ...prev, [currentPlayerId]: chat.moodTag ?? null }));
        if (chat.suggestedReplies?.length) {
          setContextualSuggestedByPlayerId((prev) => ({
            ...prev,
            [currentPlayerId]: chat.suggestedReplies?.slice(0, 3) ?? [],
          }));
        }

        appendChat(text, chat.reply, [
          ...(chat.toneTag
            ? [{ label: "Tone", val: chat.toneTag, positive: true } as Chip]
            : []),
          ...(chat.moodTag
            ? [{ label: "Mood", val: chat.moodTag, positive: true } as Chip]
            : []),
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
  const visibleSuggested = contextualSuggested.length > 0 ? contextualSuggested : suggested;

  const bondPct = Math.min(100, activeChatPlayer.bondTrust);
  const xpPct = Math.min(100, (activeChatPlayer.currentXp / activeChatPlayer.xpToNext) * 100);
  const hasNoHiredPlayers = chatCandidates.length === 0;

  useEffect(() => {
    const evaluateCompact = () => {
      const narrow = window.innerWidth <= 420;
      const manyPlayers = chatCandidates.length >= 5;
      setCompactSwitcher(narrow || manyPlayers);
    };
    evaluateCompact();
    window.addEventListener("resize", evaluateCompact);
    return () => window.removeEventListener("resize", evaluateCompact);
  }, [chatCandidates.length]);

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col safe-page-bottom with-sidebar-pad pt-3 pr-4">
      <div className="mb-2 space-y-2 px-0">
        <div className="glass-card-strong rounded-2xl p-3">
          <div className="flex items-start gap-3">
            <AnimatedPortrait player={activeChatPlayer} size="md" showMood />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate text-sm font-black text-foreground">{activeChatPlayer.name}</p>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-black text-primary">
                  Lv {activeChatPlayer.level}
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-bold text-muted-foreground">
                  {mood}
                </span>
                {aiMoodLabel && (
                  <span className="rounded-full bg-primary/12 px-2 py-0.5 text-[9px] font-bold text-primary">
                    AI: {aiMoodLabel}
                  </span>
                )}
              </div>
              <p className="truncate text-[10px] text-muted-foreground">
                {activeChatPlayer.position} · {activeChatPlayer.representedCountry} · {activeChatPlayer.clubTeam}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400"
                  style={{ width: `${xpPct}%` }}
                />
              </div>
              <p className="mt-1 text-[9px] text-muted-foreground">
                XP {activeChatPlayer.currentXp}/{activeChatPlayer.xpToNext} · Evolution {activeChatPlayer.evolutionStage + 1}/4
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
              {chatCandidates.length > 1 && compactSwitcher && (
                <div className="mt-2">
                  <label className="text-[9px] font-bold text-muted-foreground">Chat with</label>
                  <select
                    value={currentPlayerId}
                    onChange={(e) => setActiveChatPlayerId(e.target.value)}
                    className="mt-1 w-full rounded-xl border border-border/35 bg-card/40 px-2 py-1.5 text-[11px] font-semibold text-foreground outline-none"
                  >
                    {chatCandidates.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} · Lv {p.level}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              {chatCandidates.length > 1 && !compactSwitcher && (
                <div className="mt-2 flex gap-1.5 overflow-x-auto scrollbar-hide pb-0.5">
                  {chatCandidates.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActiveChatPlayerId(p.id)}
                      className={`shrink-0 rounded-xl border px-2 py-1 flex items-center gap-1.5 transition-colors ${
                        p.id === currentPlayerId
                          ? "border-primary/45 bg-primary/12"
                          : "border-border/35 bg-card/35 hover:border-primary/30"
                      }`}
                    >
                      <img src={p.portrait} alt="" className="w-5 h-5 rounded-full object-cover" />
                      <span className="text-[9px] font-bold text-foreground whitespace-nowrap">{p.name}</span>
                    </button>
                  ))}
                </div>
              )}
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

      {hasNoHiredPlayers ? (
        <div className="flex-1 flex items-center justify-center px-2">
          <div className="glass-card-strong rounded-2xl p-4 text-center max-w-sm">
            <p className="text-sm font-black text-foreground">No recruited players yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Recruit a player from Explore to unlock companion chat.
            </p>
          </div>
        </div>
      ) : (
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
      )}

      <div className="py-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-hide">
          {visibleSuggested.map((prompt, i) => (
            <button
              key={i}
              type="button"
              onClick={() => sendMessage(prompt)}
              disabled={hasNoHiredPlayers}
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
            placeholder={hasNoHiredPlayers ? "Recruit a player to start chat..." : "Message your player..."}
            disabled={hasNoHiredPlayers}
            className="flex-1 bg-transparent px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <button
            type="button"
            onClick={() => sendMessage(input)}
            disabled={hasNoHiredPlayers}
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
