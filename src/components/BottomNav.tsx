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
    <nav className="fixed bottom-0 left-0 right-0 z-50 pb-6 pt-1 px-3" style={{ background: 'linear-gradient(to top, hsl(225 30% 5% / 0.98), hsl(225 30% 5% / 0.85), transparent)' }}>
      <div className="glass-card-strong rounded-2xl px-1 py-1.5">
        <div className="flex items-center justify-around">
          {tabs.map(({ id, label, icon: Icon }) => {
            const isActive = activeTab === id;
            return (
              <button
                key={id}
                onClick={() => onTabChange(id)}
                className={`relative flex flex-col items-center gap-0.5 px-4 py-2.5 rounded-xl transition-all duration-300 ${
                  isActive
                    ? "text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {isActive && (
                  <div className="absolute inset-0 rounded-xl bg-primary/10" />
                )}
                <Icon className={`w-6 h-6 relative z-10 transition-all duration-300 ${isActive ? "scale-110 drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" : ""}`} />
                <span className={`text-[10px] font-bold tracking-wider relative z-10 uppercase ${isActive ? "text-primary" : ""}`}>
                  {label}
                </span>
                {isActive && (
                  <div className="absolute -top-0.5 left-1/2 -translate-x-1/2 w-6 h-0.5 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
};

export default BottomNav;
