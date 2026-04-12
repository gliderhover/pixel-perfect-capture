import { X, MapPin, Sparkles, Dumbbell, Trophy, Radio, Camera, Layers, Medal } from "lucide-react";

interface RulesPanelProps {
  open: boolean;
  onClose: () => void;
}

const cards = [
  {
    icon: MapPin,
    title: "Explore zones",
    body: "Walk the map, tap pins, and enter stadiums, training grounds, and camera missions.",
  },
  {
    icon: Sparkles,
    title: "Collect cards",
    body: "Encounter players in the wild. Duplicates become shards for upgrades.",
  },
  {
    icon: Dumbbell,
    title: "Train & bond",
    body: "Chat with your active player to boost morale, confidence, and coach trust.",
  },
  {
    icon: Trophy,
    title: "Level up",
    body: "Earn XP from missions and events. Evolution stages unlock stronger frames & presence.",
  },
  {
    icon: Medal,
    title: "Compete",
    body: "Climb Global & Region boards. Streaks and coach level show who’s hot.",
  },
  {
    icon: Radio,
    title: "Live events",
    body: "React to boosts and limited windows — they can shift mood and stats fast.",
  },
  {
    icon: Camera,
    title: "Camera missions",
    body: "Complete quick photo challenges at marked spots for bonus XP and story beats.",
  },
];

const RulesPanel = ({ open, onClose }: RulesPanelProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1400] flex" onClick={onClose}>
      <div
        className="h-full w-full max-w-md animate-slide-up border-r border-border/30 bg-background/95 shadow-2xl backdrop-blur-xl"
        style={{ paddingLeft: "max(0px, env(safe-area-inset-left))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/25 px-4 py-3 pt-[max(12px,env(safe-area-inset-top))]">
          <div>
            <h2 className="text-lg font-black text-foreground">How it works</h2>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Quick guide</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-2.5 overflow-y-auto px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))]">
          <div className="glass-card flex gap-3 rounded-2xl border border-primary/20 p-3">
            <Layers className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
            <div>
              <p className="text-xs font-black text-foreground">Core loop</p>
              <p className="text-[11px] leading-snug text-muted-foreground">
                Explore → collect → train → level → compete → react live. Repeat.
              </p>
            </div>
          </div>

          {cards.map(({ icon: Icon, title, body }) => (
            <div key={title} className="glass-card flex gap-3 rounded-2xl p-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/12 text-primary">
                <Icon className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs font-black text-foreground">{title}</p>
                <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{body}</p>
              </div>
            </div>
          ))}

          <div className="glass-card rounded-2xl p-3">
            <p className="text-xs font-black text-foreground">Rarity & growth</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Common → Rare → Epic → Legendary affects ceiling and shard value. Everyone starts modest — power comes from XP,
              duplicates, training, and streaks.
            </p>
          </div>

          <div className="glass-card rounded-2xl p-3">
            <p className="text-xs font-black text-foreground">Leaderboards</p>
            <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              Global ranks the world. Region groups nearby competition (mock: CONCACAF-style). Weekly resets often; All Time is
              legacy glory.
            </p>
          </div>
        </div>
      </div>
      <div className="flex-1 bg-background/55 backdrop-blur-sm" />
    </div>
  );
};

export default RulesPanel;
