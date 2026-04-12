import { X, MapPin, Sparkles, Dumbbell, Trophy, Radio, Camera, Layers, Medal, Shield, Heart, Users, Flame, Zap, Target, TrendingUp } from "lucide-react";

interface RulesPanelProps {
  open: boolean;
  onClose: () => void;
}

const RulesPanel = ({ open, onClose }: RulesPanelProps) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[1400] flex" onClick={onClose}>
      <div
        className="h-full w-full max-w-md animate-slide-up border-r border-border/30 bg-background/95 shadow-2xl backdrop-blur-xl overflow-y-auto"
        style={{ paddingLeft: "max(0px, env(safe-area-inset-left))" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-border/25 px-4 py-3 pt-[max(12px,env(safe-area-inset-top))] sticky top-0 bg-background/95 backdrop-blur-xl z-10">
          <div>
            <h2 className="text-lg font-black text-foreground">How It Works</h2>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-primary">Game Guide</p>
          </div>
          <button type="button" onClick={onClose}
            className="flex h-10 w-10 items-center justify-center rounded-xl text-muted-foreground hover:bg-muted/60" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-4 py-4 pb-[max(16px,env(safe-area-inset-bottom))] space-y-5">
          {/* Core Loop */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/12 flex items-center justify-center">
                <Layers className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-black text-foreground">Core Loop</h3>
            </div>
            <div className="glass-card rounded-2xl p-3 border border-primary/20">
              <div className="flex flex-wrap gap-1.5 items-center">
                {["Explore", "→", "Scan", "→", "Encounter", "→", "Penalty Duel", "→", "Recruit", "→", "Train", "→", "Compete"].map((item, i) => (
                  item === "→" ? (
                    <span key={i} className="text-primary/50 text-xs">→</span>
                  ) : (
                    <span key={i} className="px-2 py-1 rounded-lg bg-primary/8 text-[10px] font-bold text-foreground">{item}</span>
                  )
                ))}
              </div>
              <p className="text-[11px] text-muted-foreground mt-2 leading-relaxed">
                Walk the map, enter zones, find players, defend penalty kicks to recruit them, then train and compete to climb leaderboards.
              </p>
            </div>
          </section>

          {/* Recruitment */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/12 flex items-center justify-center">
                <Shield className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-black text-foreground">Player Recruitment</h3>
            </div>
            <div className="space-y-2">
              {[
                { icon: "⚽", title: "Penalty Duel", desc: "Tap a player marker on the map. Defend their penalty kick to recruit them." },
                { icon: "🧤", title: "Keeper Gloves", desc: "Equip better gloves for wider save windows and dive forgiveness." },
                { icon: "🎯", title: "Focus Points", desc: "Spend FP to attempt duels and retry failed saves. Earn FP from zones and camera missions." },
                { icon: "📊", title: "Start Weak", desc: "All recruits start at Level 1 with low stats. Grow through training, chat, and streaks." },
              ].map((item) => (
                <div key={item.title} className="glass-card flex gap-3 rounded-2xl p-3">
                  <span className="text-xl shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-xs font-black text-foreground">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Zones */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/12 flex items-center justify-center">
                <MapPin className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-black text-foreground">Zones</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: "⚽", name: "Training Ground", effect: "+Form" },
                { icon: "💆", name: "Recovery Center", effect: "+Morale" },
                { icon: "📣", name: "Fan Arena", effect: "+Fan Bond" },
                { icon: "⚔️", name: "Rival Pitch", effect: "+Confidence" },
                { icon: "🔥", name: "Pressure Zone", effect: "+Confidence" },
                { icon: "🏟️", name: "Stadium Zone", effect: "Live Bonuses" },
              ].map((z) => (
                <div key={z.name} className="glass-card p-2.5 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{z.icon}</span>
                    <p className="text-[10px] font-bold text-foreground truncate">{z.name}</p>
                  </div>
                  <p className="text-[10px] text-primary font-semibold">{z.effect}</p>
                </div>
              ))}
            </div>
          </section>

          {/* Points & Progression */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/12 flex items-center justify-center">
                <TrendingUp className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-black text-foreground">Points & Progression</h3>
            </div>
            <div className="space-y-2">
              {[
                { icon: "⭐", title: "XP & Levels", desc: "Earn XP from zones, duels, camera, and challenges. Level up to unlock stronger stats." },
                { icon: "🔮", title: "Evolution", desc: "Collect duplicate shards (10 per stage) to evolve: Stage 0 → 1 → 2 → 3." },
                { icon: "💎", title: "Rarity", desc: "Common → Rare → Epic → Legendary. Higher rarity = higher stat ceiling and harder to recruit." },
                { icon: "🎯", title: "Focus Points", desc: "Used for penalty duel attempts and retries. Earned from zones, camera, and training." },
              ].map((item) => (
                <div key={item.title} className="glass-card flex gap-3 rounded-2xl p-3">
                  <span className="text-xl shrink-0">{item.icon}</span>
                  <div>
                    <p className="text-xs font-black text-foreground">{item.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{item.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Camera Missions */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/12 flex items-center justify-center">
                <Camera className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-black text-foreground">Camera Missions</h3>
            </div>
            <div className="glass-card rounded-2xl p-3">
              <p className="text-[11px] text-muted-foreground leading-relaxed">
                Scan your environment to earn <span className="text-foreground font-bold">XP, Focus Points, and attribute boosts</span>.
                Camera missions connect directly to recruitment — completing a scan can reveal hidden player markers,
                grant temporary duel advantages, or boost encounter rates.
              </p>
              <div className="flex gap-2 mt-2.5">
                {["📸 Scan", "🎯 Earn FP", "⚡ Boost Encounters"].map((tag) => (
                  <span key={tag} className="px-2 py-1 rounded-lg bg-primary/8 text-[10px] font-bold text-foreground">{tag}</span>
                ))}
              </div>
            </div>
          </section>

          {/* Compete & Leaderboards */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/12 flex items-center justify-center">
                <Trophy className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-black text-foreground">Compete & Leaderboards</h3>
            </div>
            <div className="space-y-2">
              <div className="glass-card rounded-2xl p-3">
                <p className="text-xs font-black text-foreground mb-1">Challenges</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Challenge nearby rivals using your active player. Matchups compare level, attributes, and rarity.
                  Win to earn XP, FP, and climb divisions.
                </p>
              </div>
              <div className="glass-card rounded-2xl p-3">
                <p className="text-xs font-black text-foreground mb-1">Leaderboards</p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  <span className="text-foreground font-bold">Global</span> ranks the world.{" "}
                  <span className="text-foreground font-bold">Region</span> groups nearby competition.
                  Score comes from wins, streaks, and coach level.
                </p>
              </div>
            </div>
          </section>

          {/* Attributes */}
          <section>
            <div className="flex items-center gap-2 mb-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/12 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              <h3 className="text-sm font-black text-foreground">Player Attributes</h3>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {[
                { name: "Confidence", icon: "💪", desc: "From pressure zones & wins" },
                { name: "Form", icon: "📈", desc: "From training drills" },
                { name: "Morale", icon: "❤️", desc: "From recovery & chat" },
                { name: "Fan Bond", icon: "📣", desc: "From fan arenas & camera" },
              ].map((attr) => (
                <div key={attr.name} className="glass-card p-2.5 rounded-xl">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className="text-sm">{attr.icon}</span>
                    <p className="text-[10px] font-bold text-foreground">{attr.name}</p>
                  </div>
                  <p className="text-[10px] text-muted-foreground">{attr.desc}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
      <div className="flex-1 bg-background/55 backdrop-blur-sm" />
    </div>
  );
};

export default RulesPanel;
