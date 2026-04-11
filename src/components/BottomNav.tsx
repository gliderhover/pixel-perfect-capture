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
    <nav className="fixed bottom-0 left-0 right-0 z-50 glass-card rounded-t-3xl rounded-b-none border-b-0 px-2 pb-6 pt-2 safe-area-bottom">
      <div className="flex items-center justify-around">
        {tabs.map(({ id, label, icon: Icon }) => {
          const isActive = activeTab === id;
          return (
            <button
              key={id}
              onClick={() => onTabChange(id)}
              className={`flex flex-col items-center gap-1 px-4 py-2 rounded-2xl transition-all duration-300 ${
                isActive
                  ? "text-primary glow-primary bg-primary/10"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <Icon className={`w-6 h-6 transition-transform duration-300 ${isActive ? "scale-110" : ""}`} />
              <span className={`text-[10px] font-semibold tracking-wide ${isActive ? "text-primary" : ""}`}>
                {label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
