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
    coachName,
    setCoachName,
  } = useGameProgress();

  const chatRef = useRef<HTMLDivElement>(null);
  const [trainingBanner, setTrainingBanner] = useState<{ xpGained: number; deltas: Record<string, number> } | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [activeChatPlayerId, setActiveChatPlayerId] = useState<string | null>(null);
  const [messagesByPlayerId, setMessagesByPlayerId] = useState<ChatThreadState>({});
  const [input, setInput] = useState("");
  const [isPending, setIsPending] = useState(false);
  const [inputFocused, setInputFocused] = useState(false);
  const [zoneFlavorText, setZoneFlavorText] = useState<string | null>(null);
  const [showNamePrompt, setShowNamePrompt] = useState(() => !coachName);
  const [nameInput, setNameInput] = useState("");
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
      const defaultId = chatCandidates.find((p) => p.id === player.id)?.id ?? chatCandidates[0]!.id;
      setActiveChatPlayerId(defaultId);
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
    const firstName = activeChatPlayer.name.split(" ")[0] ?? activeChatPlayer.name;
    const coachAddress = coachName ? coachName : "Coach";
    const humanOpeners = [
      `${coachAddress}! It's ${firstName}. ${matchCopy[matchPhase] ?? matchCopy.idle}.`,
      `Hey ${coachAddress} — ${firstName} checking in. ${matchCopy[matchPhase] ?? matchCopy.idle}.`,
      `${firstName} here. ${matchCopy[matchPhase] ?? matchCopy.idle}.`,
      `Good to talk, ${coachAddress}. ${firstName} — ${matchCopy[matchPhase] ?? matchCopy.idle}.`,
    ];
    const openerIndex = activeChatPlayer.id.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0) % humanOpeners.length;
    const opener = humanOpeners[openerIndex] ?? humanOpeners[0];
    setMessagesByPlayerId((prev) => {
      if (prev[currentPlayerId]?.length) return prev;
      return {
        ...prev,
        [currentPlayerId]: [
          {
            id: 1,
            from: "player",
            text: `${opener}${zoneHint}${streakHint}${aiHint}`,
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
    activeChatPlayer.id,
    matchPhase,
    explorationZoneType,
    zoneName,
    competitiveStreak,
    zoneFlavorText,
    coachName,
  ]);

  useEffect(() => {
    chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const appendUserMsg = (text: string) => {
    setMessagesByPlayerId((prev) => ({
      ...prev,
      [currentPlayerId]: [...(prev[currentPlayerId] ?? []), { id: Date.now(), from: "user" as const, text }],
    }));
  };
  const appendPlayerMsg = (text: string, chips: Chip[]) => {
    setMessagesByPlayerId((prev) => ({
      ...prev,
      [currentPlayerId]: [...(prev[currentPlayerId] ?? []), { id: Date.now() + 1, from: "player" as const, text, chips }],
    }));
  };

  const appendChat = (userText: string, playerText: string, chips: Chip[]) => {
    appendUserMsg(userText);
    appendPlayerMsg(playerText, chips);
  };

  const trainViaApi = async (
    mode: "balanced" | "confidence" | "form" | "morale" | "bond",
    userText: string,
    playerText: string
  ) => {
    appendUserMsg(userText);
    setIsPending(true);
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
      appendPlayerMsg(playerText, chips);
      setIsPending(false);
    } catch (error) {
      appendPlayerMsg("Can't lock in the training update right now. Try again in a second.", [
        {
          label: "Error",
          val: error instanceof Error ? error.message : "training failed",
          positive: false,
        },
      ]);
      setIsPending(false);
    }
  };

  const sendTrainingChoice = (kind: "motivate" | "tactics" | "recovery") => {
    const z = explorationZoneType;
    if (kind === "motivate") {
      void trainViaApi(
        "balanced",
        "Pump me up — what's the mindset?",
        z === "rival"
          ? "We're going after that duel and we're taking it. Simple. No second thoughts."
          : "Right now I'm locked in. When the belief is there between us, the whole game feels different."
      );
      return;
    }
    if (kind === "tactics") {
      void trainViaApi(
        "form",
        "What should I be working on right now?",
        z === "training"
          ? "First touch under pressure — that's the one to sharpen. Everything flows from there."
          : "Timing the runs and staying compact in shape. Get those two right and the rest follows."
      );
      return;
    }
    void trainViaApi(
      "bond",
      "How are you feeling?",
      z === "recovery"
        ? "Honestly? Legs are feeling it. But I'm managing. Rest and mindset — that's the reset."
        : "I'm alright. Could be sharper, but I'm focused. The body's telling me to look after it today."
    );
  };

  const sendMessage = (text: string) => {
    if (!text.trim()) return;
    appendUserMsg(text);
    setIsPending(true);
    setInput("");
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
            coachName: coachName || undefined,
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
        appendPlayerMsg(chat.reply, [
          { label: "XP", val: "+6", positive: true },
          { label: "Confidence", val: `${chat.attributeDeltas.confidence >= 0 ? "+" : ""}${chat.attributeDeltas.confidence}`, positive: chat.attributeDeltas.confidence >= 0 },
          { label: "Form", val: `${chat.attributeDeltas.form >= 0 ? "+" : ""}${chat.attributeDeltas.form}`, positive: chat.attributeDeltas.form >= 0 },
          { label: "Morale", val: `${chat.attributeDeltas.morale >= 0 ? "+" : ""}${chat.attributeDeltas.morale}`, positive: chat.attributeDeltas.morale >= 0 },
          { label: "Fan bond", val: `${chat.attributeDeltas.fanBond >= 0 ? "+" : ""}${chat.attributeDeltas.fanBond}`, positive: chat.attributeDeltas.fanBond >= 0 },
        ]);
        setIsPending(false);
      } catch (error) {
        appendPlayerMsg("Connection dropped. I couldn't process that message yet.", [
          { label: "Error", val: error instanceof Error ? error.message : "chat failed", positive: false },
        ]);
        setIsPending(false);
      }
    };
    void run();
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
    <div className="flex h-[100dvh] min-h-[100dvh] flex-col safe-page-bottom with-sidebar-pad pt-5 pr-4">
      <div className="mb-2 px-0">
        <div className="glass-card-strong rounded-2xl p-3 mb-2">
          <div className="flex items-center gap-3">
            <AnimatedPortrait player={activeChatPlayer} size="md" showMood />
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <p className="text-sm font-black text-foreground leading-tight">{activeChatPlayer.name}</p>
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
              {/* Live attribute badges */}
              <div className="mt-1.5 flex gap-1.5 flex-wrap">
                {[
                  { label: "Conf", val: activeChatPlayer.attributes.confidence, color: "text-amber-400" },
                  { label: "Form", val: activeChatPlayer.attributes.form, color: "text-emerald-400" },
                  { label: "Morale", val: activeChatPlayer.attributes.morale, color: "text-sky-400" },
                  { label: "Bond", val: activeChatPlayer.attributes.fanBond, color: "text-pink-400" },
                ].map(({ label, val, color }) => (
                  <span key={label} className="text-[9px] font-black rounded-md bg-muted/50 px-1.5 py-0.5">
                    <span className="text-muted-foreground">{label} </span>
                    <span className={color}>{val}</span>
                  </span>
                ))}
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
        <></>
      </div>

      {showNamePrompt && (
        <div
          className="fixed z-[300] flex items-end justify-center bg-black/50 backdrop-blur-sm animate-fade-in"
          style={{ top: 0, bottom: 0, left: "var(--game-sidebar-width, 56px)", right: 0 }}
          onClick={(e) => { if (e.target === e.currentTarget) setShowNamePrompt(false); }}>
          <div className="w-full max-w-md glass-card-strong rounded-t-3xl px-5 pt-4 animate-fade-in-up"
            style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}>
            {/* drag handle */}
            <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" />
            <p className="text-sm font-black text-foreground">What should I call you, Coach?</p>
            <p className="text-[11px] text-muted-foreground mt-0.5 mb-4">Optional — tap Skip to continue</p>
            <input
              type="text"
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") { if (nameInput.trim()) setCoachName(nameInput.trim()); setShowNamePrompt(false); } }}
              placeholder="Your name…"
              maxLength={20}
              autoFocus
              style={{ fontSize: "16px" }}
              className="w-full bg-muted/40 rounded-2xl px-4 py-3 text-sm text-foreground outline-none placeholder:text-muted-foreground border border-border/30 mb-3"
            />
            <button type="button"
              onClick={() => { if (nameInput.trim()) setCoachName(nameInput.trim()); setShowNamePrompt(false); }}
              className="w-full py-3 rounded-2xl bg-primary text-primary-foreground text-sm font-black active:scale-95 transition-transform">
              {nameInput.trim() ? "Got it 👍" : "Skip for now"}
            </button>
          </div>
        </div>
      )}

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
        {isPending && (
          <div className="flex justify-start animate-fade-in">
            <div className="glass-card rounded-2xl rounded-bl-md px-4 py-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground/60 animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
      </div>
      )}

      <div className="py-1.5">
        {!inputFocused && !isPending && (
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-0.5">
            {/* Quick action chips */}
            {([
              ["motivate", "🔥 Pump me up"],
              ["tactics", "💡 What to work on?"],
              ["recovery", "💬 How are you feeling?"],
            ] as const).map(([key, label]) => (
              <button key={key} type="button" onClick={() => sendTrainingChoice(key)}
                disabled={hasNoHiredPlayers}
                className="shrink-0 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-[10px] font-bold text-primary transition-all hover:bg-primary/15 active:scale-95 whitespace-nowrap">
                {label}
              </button>
            ))}
            {/* Divider dot */}
            <span className="text-muted-foreground/40 self-center text-[10px] shrink-0">·</span>
            {/* Contextual suggestion chips */}
            {visibleSuggested.map((prompt, i) => (
              <button key={i} type="button" onClick={() => sendMessage(prompt)} disabled={hasNoHiredPlayers}
                className="shrink-0 rounded-xl border border-border/30 bg-card/40 px-3 py-2 text-[10px] font-semibold text-foreground/90 transition-all hover:border-primary/35 active:scale-95 whitespace-nowrap">
                {prompt}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="pb-2">
        <div className="glass-card-strong flex items-center gap-2 rounded-2xl p-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && sendMessage(input)}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            placeholder={hasNoHiredPlayers ? "Recruit a player to start chat..." : "Message your player..."}
            disabled={hasNoHiredPlayers}
            style={{ fontSize: "16px" }}
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
