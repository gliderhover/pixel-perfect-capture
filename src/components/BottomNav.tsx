import { Compass, Users, Dumbbell, Swords, Radio } from "lucide-react";

type Tab = "explore" | "squad" | "train" | "compete" | "live";

interface BottomNavProps {
  activeTab: Tab;
  onTabChange: (tab: Tab) => void;
}

const tabs: { id: Tab; label: string; icon: typeof Compass }[] = [
  { id: "explore", label: "Explore", icon: Compass },
  { id: "squad", label: "Squad", icon: Users },
  { id: "train", label: "Train", icon: Dumbbell },
  { id: "compete", label: "Compete", icon: Swords },
  { id: "live", label: "Live", icon: Radio },
];

const BottomNav = ({ activeTab, onTabChange }: BottomNavProps) => {
  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-[1200]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 4px)" }}
    >
      <div className="mx-2 mb-1 rounded-2xl bg-background/80 backdrop-blur-xl border border-border/20 shadow-lg">
        <div className="flex items-center justify-around px-1 py-1">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`relative flex flex-col items-center gap-0 px-3 py-1.5 rounded-xl transition-all duration-200 ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-primary/8" />
                )}
                <Icon className={`w-5 h-5 relative z-10 transition-all duration-200 ${isActive ? "drop-shadow-[0_0_6px_hsl(var(--primary)/0.4)]" : ""}`} />
                <span className={`text-[9px] font-bold tracking-wide relative z-10 uppercase leading-tight mt-0.5`}>
                  {label}
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
