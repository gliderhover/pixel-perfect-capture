import { useState, useEffect } from "react";
import { mockPlayers } from "@/data/mockData";
import AnimatedPortrait from "./AnimatedPortrait";
import { useGameProgress } from "@/context/GameProgressContext";
import { recruitUserPlayer } from "@/lib/apiService";

const GIFT_KEY = "ppc-gift-given";

/** Pick a deterministic rare player based on userId so the same user always gets the same starter */
function pickGiftPlayer(userId: string) {
  const rarePlayers = mockPlayers.filter((p) => p.rarity === "rare");
  const pool = rarePlayers.length > 0 ? rarePlayers : mockPlayers;
  const seed = userId.split("").reduce((acc, c) => acc + c.charCodeAt(0), 0);
  return pool[seed % pool.length] ?? pool[0];
}

interface WelcomeGiftPopupProps {
  onDone: () => void;
}

const WelcomeGiftPopup = ({ onDone }: WelcomeGiftPopupProps) => {
  const { userId, refreshOwnedPlayers, setActivePlayerId } = useGameProgress();
  const giftPlayer = pickGiftPlayer(userId);

  const [phase, setPhase] = useState<"box" | "reveal" | "done">("box");
  const [error, setError] = useState<string | null>(null);

  // Snap the active player to the gift IMMEDIATELY (before the API call lands)
  // so other screens don't briefly fall back to the legendary placeholder.
  useEffect(() => {
    setActivePlayerId(giftPlayer.id);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Recruit the player as soon as the component mounts (silently, don't block UX)
  useEffect(() => {
    let cancelled = false;
    const gift = async () => {
      try {
        await recruitUserPlayer(userId, giftPlayer.id);
        if (!cancelled) {
          await refreshOwnedPlayers();
          setActivePlayerId(giftPlayer.id); // re-assert in case it got cleared
        }
      } catch {
        // Non-fatal — player may already be owned or API may be offline; onboarding continues either way
      }
    };
    void gift();
    return () => { cancelled = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleBoxTap = () => setPhase("reveal");

  const handleDone = () => {
    localStorage.setItem(GIFT_KEY, "1");
    onDone();
  };

  return (
    <div
      className="fixed z-[2100] flex items-end justify-center bg-black/70 backdrop-blur-sm animate-fade-in"
      style={{ top: 0, bottom: 0, left: "var(--game-sidebar-width, 56px)", right: 0 }}
    >
      <div
        className="w-full max-w-md bg-card border-t border-border/30 rounded-t-3xl px-5 pt-5 animate-slide-up"
        style={{ paddingBottom: "max(1.75rem, env(safe-area-inset-bottom))" }}
      >
        {/* Drag handle */}
        <div className="w-10 h-1 rounded-full bg-muted-foreground/30 mx-auto mb-4" />

        {phase === "box" && (
          <div className="flex flex-col items-center text-center animate-fade-in">
            <p className="text-[10px] font-black uppercase tracking-widest text-primary mb-2">
              🎁 Welcome Gift
            </p>
            <h2 className="text-2xl font-black text-foreground mb-1">You've got a free player!</h2>
            <p className="text-sm text-muted-foreground mb-8 max-w-xs leading-relaxed">
              Every coach starts with one. Tap the gift to reveal your starter — then hit the map to scout more.
            </p>

            {/* Gift box */}
            <button
              type="button"
              onClick={handleBoxTap}
              className="w-36 h-36 rounded-3xl bg-gradient-to-br from-primary/20 to-emerald-400/20 border-2 border-primary/30 flex items-center justify-center text-6xl active:scale-90 transition-transform mb-8 animate-float-slow"
              aria-label="Tap to reveal your gift player"
            >
              🎁
            </button>

            <p className="text-xs text-muted-foreground">Tap the gift to reveal</p>
          </div>
        )}

        {phase === "reveal" && (
          <div className="flex flex-col items-center text-center animate-scale-in">
            {/* Glow backdrop */}
            <div
              className="absolute inset-0 rounded-t-3xl pointer-events-none"
              style={{ background: "radial-gradient(ellipse at 50% 80%, hsl(var(--primary)/0.12), transparent 65%)" }}
            />

            <p className="relative text-[10px] font-black uppercase tracking-widest text-primary mb-2">
              ✨ Your Starter Player
            </p>

            <div className="relative mb-3">
              <AnimatedPortrait player={giftPlayer} size="xl" showMood />
              {/* Rarity badge */}
              <span className="absolute -top-2 -right-2 rounded-full bg-glow-rare/20 border border-glow-rare/50 text-glow-rare text-[8px] font-black px-2 py-0.5 uppercase tracking-wider">
                {giftPlayer.rarity}
              </span>
            </div>

            <h3 className="relative text-2xl font-black text-foreground leading-tight px-2 mb-0.5">
              {giftPlayer.name}
            </h3>
            <p className="relative text-sm text-muted-foreground mb-1">
              {giftPlayer.position} · {giftPlayer.nationalTeam}
            </p>
            <p className="relative text-[10px] font-bold text-primary mb-6">
              {giftPlayer.traits[0]}
            </p>

            {error && (
              <p className="relative text-[10px] text-destructive mb-3">{error}</p>
            )}

            {/* Scout tip */}
            <div className="relative w-full glass-card rounded-2xl p-4 mb-6 text-left">
              <p className="text-xs font-black text-foreground mb-2">How to scout your next player 📍</p>
              <ol className="space-y-1.5">
                {[
                  "Open the Explore tab (map icon)",
                  "Move around — player markers appear nearby",
                  "Tap a glowing marker to challenge them",
                  "Win the penalty duel to recruit them",
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-2 text-[11px] text-muted-foreground leading-snug">
                    <span className="shrink-0 w-4 h-4 rounded-full bg-primary/15 text-primary text-[9px] font-black flex items-center justify-center mt-px">
                      {i + 1}
                    </span>
                    {step}
                  </li>
                ))}
              </ol>
            </div>

            <button
              type="button"
              onClick={handleDone}
              className="relative w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground font-black text-sm floating-button glow-primary"
            >
              Start Playing ⚡
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const shouldShowGift = (): boolean =>
  !localStorage.getItem(GIFT_KEY);

export default WelcomeGiftPopup;
