import { useState, useRef, useEffect, useMemo } from "react";
import { Send, Heart } from "lucide-react";
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

interface TrainScreenProps {
  onTrainingComplete?: () => void;
  streakCount?: number;
}

const TrainScreen = ({ onTrainingComplete, streakCount = 0 }: TrainScreenProps) => {
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
  const [trainingBanner, setTrainingBanner] = useState<{ xpGained: number; deltas: Record<string, number> } | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [activeChatPlayerId, setActiveChatPlayerId] = useState<string | null>(null);
  const [messagesByPlayerId, setMessagesByPlayerId] = useState<ChatThreadState>({});
  const [input, setInput] = useState("");
  const [zoneFlavorText, setZoneFlavorText] = useState<string | null>(null);
  const [aiMoodLabelByPlayerId, setAiMoodLabelByPlayerId] = useState<TextByPlayerState>({});
  const [contextualSuggestedByPlayerId, setContextualSuggestedByPlayerId] = useState<SuggestionsByPlayerState>({});
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
    return () => { if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current); };
  }, []);

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
      const deltas: Record<string, number> = {};
      if (result.delta.confidence) deltas["Confidence"] = result.delta.confidence;
      if (result.delta.form) deltas["Form"] = result.delta.form;
      if (result.delta.morale) deltas["Morale"] = result.delta.morale;
      if (result.delta.fanBond) deltas["Fan Bond"] = result.delta.fanBond;
      if (Object.keys(deltas).length > 0 || result.xpGained) {
        setTrainingBanner({ xpGained: result.xpGained, deltas });
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => setTrainingBanner(null), 4000);
      }
      onTrainingComplete?.();
      const trainDeltas = {
        Confidence: result.delta.confidence ?? 0,
        Form: result.delta.form ?? 0,
        Morale: result.delta.morale ?? 0,
        "Fan bond": result.delta.fanBond ?? 0,
      };
      const topTrainAttr = Object.entries(trainDeltas)
        .filter(([, v]) => v !== 0)
        .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
      const chips: Chip[] = [{ label: "XP", val: `+${result.xpGained}`, positive: true }];
      if (topTrainAttr) chips.push({ label: topTrainAttr[0], val: `${topTrainAttr[1] >= 0 ? "+" : ""}${topTrainAttr[1]}`, positive: topTrainAttr[1] >= 0 });
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

  const sendTrainingChoice = (kind: "motivate" | "tactics" | "recovery") => {
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

        const attrDeltas = chat.attributeDeltas;
        const topAttr = Object.entries({
          Confidence: attrDeltas.confidence,
          Form: attrDeltas.form,
          Morale: attrDeltas.morale,
          "Fan bond": attrDeltas.fanBond,
        }).sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))[0];
        appendChat(text, chat.reply, [
          { label: "XP", val: "+6", positive: true },
          ...(topAttr ? [{ label: topAttr[0], val: `${topAttr[1] >= 0 ? "+" : ""}${topAttr[1]}`, positive: topAttr[1] >= 0 }] : []),
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

  return (
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col safe-page-bottom with-sidebar-pad pt-3 pr-4">
      <div className="mb-2 px-0">
        <div className="glass-card-strong rounded-2xl p-3 mb-2">
          <div className="flex items-center gap-3">
            <AnimatedPortrait player={activeChatPlayer} size="md" showMood />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-black text-foreground truncate">{activeChatPlayer.name}</p>
                <span className="rounded-full bg-primary/15 px-2 py-0.5 text-[9px] font-black text-primary shrink-0">Lv {activeChatPlayer.level}</span>
              </div>
              <p className="text-[10px] text-muted-foreground truncate">{activeChatPlayer.position}</p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                <div className="h-full rounded-full bg-gradient-to-r from-primary to-emerald-400" style={{ width: `${xpPct}%` }} />
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <Heart className="h-3 w-3 shrink-0 text-accent" />
                <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-gradient-to-r from-accent/80 to-accent" style={{ width: `${bondPct}%` }} />
                </div>
                {streakCount > 0 && <span className="text-[9px] text-accent font-bold shrink-0">🔥 {streakCount}d</span>}
              </div>
            </div>
          </div>
          {/* Player switcher - only if >1 player */}
          {chatCandidates.length > 1 && (
            <div className="flex gap-1.5 overflow-x-auto scrollbar-hide mt-2.5 pt-2.5 border-t border-border/20">
              {chatCandidates.map((p) => (
                <button key={p.id} type="button" onClick={() => setActiveChatPlayerId(p.id)}
                  className={`shrink-0 flex items-center gap-1.5 rounded-xl px-2 py-1 transition-colors ${p.id === currentPlayerId ? "bg-primary/15 border border-primary/30" : "bg-muted/30 border border-transparent"}`}>
                  <img src={p.portrait} alt="" className="w-5 h-5 rounded-full object-cover shrink-0" />
                  <span className="text-[9px] font-bold text-foreground whitespace-nowrap">{p.name.split(" ").pop()}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        {/* Action buttons - 3 only */}
        <div className="flex gap-2">
          {([
            ["motivate", "⚡ Motivate"],
            ["tactics", "📋 Tactics"],
            ["recovery", "🔋 Recovery"],
          ] as const).map(([key, label]) => (
            <button key={key} type="button" onClick={() => sendTrainingChoice(key)}
              className="flex-1 py-3 rounded-xl border border-border/40 bg-card/50 text-[10px] font-bold text-foreground transition-colors hover:border-primary/40 hover:bg-primary/10">
              {label}
            </button>
          ))}
        </div>
      </div>

      {trainingBanner && (
        <div className="glass-card-strong rounded-2xl p-3 mb-2 border border-primary/30 animate-fade-in-up">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest mb-2">
            ✓ Training session complete · +{trainingBanner.xpGained} XP
          </p>
          <div className="flex flex-wrap gap-1.5">
            {Object.entries(trainingBanner.deltas).map(([attr, delta]) => (
              <span
                key={attr}
                className={`text-[9px] font-black px-2 py-0.5 rounded-full ${
                  delta > 0 ? "bg-primary/15 text-primary" : "bg-destructive/15 text-destructive"
                }`}
              >
                {attr} {delta > 0 ? "+" : ""}{delta}
              </span>
            ))}
          </div>
        </div>
      )}

      {hasNoHiredPlayers ? (
        <div className="flex-1 flex items-center justify-center px-2">
          <div className="glass-card-strong rounded-2xl p-6 text-center max-w-sm">
            <div className="text-4xl mb-3">🏆</div>
            <p className="text-sm font-black text-foreground mb-1">No players recruited yet</p>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed mb-4">
              Head to the Explore map, save a penalty duel, and your first player will appear here ready to chat.
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
