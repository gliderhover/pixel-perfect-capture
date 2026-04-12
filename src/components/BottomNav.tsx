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
      className="fixed bottom-0 left-0 right-0 z-[1080] pointer-events-none"
      style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 2px)" }}
    >
      <div className="pointer-events-auto mx-2 mb-0.5 rounded-xl bg-background/85 backdrop-blur-xl border border-border/20 shadow-lg">
        <div className="flex items-center justify-around px-0.5 py-0.5">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onTabChange(id)}
                className={`relative flex flex-col items-center gap-0 px-1.5 py-0.5 rounded-lg transition-all duration-200 min-w-0 flex-1 max-w-[4.5rem] ${
                  isActive ? "text-primary" : "text-muted-foreground"
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-lg bg-primary/8" />
                )}
                <Icon className={`w-4 h-4 shrink-0 relative z-10 transition-all duration-200 ${isActive ? "drop-shadow-[0_0_6px_hsl(var(--primary)/0.4)]" : ""}`} />
                <span className="text-[7px] font-bold tracking-wide relative z-10 uppercase leading-none mt-0.5 truncate w-full text-center">
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
