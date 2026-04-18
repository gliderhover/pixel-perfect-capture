import { useEffect, useState } from "react";
import {
  BookOpen,
  ChevronLeft,
  ChevronRight,
  Compass,
  Dumbbell,
  Radio,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";

export type AppTab = "explore" | "squad" | "train" | "compete" | "live" | "leaderboard";

type Item = { id: AppTab | "rules"; label: string; icon: typeof Compass };

const items: Item[] = [
  { id: "explore", label: "Explore", icon: Compass },
  { id: "squad", label: "Squad", icon: Users },
  { id: "train", label: "Train", icon: Dumbbell },
  { id: "compete", label: "Compete", icon: Swords },
  { id: "live", label: "Live", icon: Radio },
  { id: "leaderboard", label: "Board", icon: Trophy },
  { id: "rules", label: "Rules", icon: BookOpen },
];

interface FoldableSidebarProps {
  active: AppTab;
  onNavigate: (tab: AppTab) => void;
  onOpenRules: () => void;
  badgeTabs?: ReadonlySet<string>;
}

const COLLAPSED = 52;
const EXPANDED = 200;

const FoldableSidebar = ({ active, onNavigate, onOpenRules, badgeTabs }: FoldableSidebarProps) => {
  const [expanded, setExpanded] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const check = () => {
      const mobile = window.innerWidth <= 430;
      setIsMobile(mobile);
      if (mobile) setExpanded(false);
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const widthPx = expanded ? EXPANDED : COLLAPSED;

  useEffect(() => {
    document.documentElement.style.setProperty("--game-sidebar-width", `${widthPx}px`);
    return () => {
      document.documentElement.style.setProperty("--game-sidebar-width", `56px`);
    };
  }, [widthPx]);

  return (
    <>
      {isMobile && expanded && (
        <div
          className="fixed inset-0 z-[1259] bg-background/50 backdrop-blur-sm"
          onClick={() => setExpanded(false)}
        />
      )}
      <aside
        className={cn(
          "fixed z-[1260] flex flex-col rounded-r-2xl border border-border/25 border-l-0",
          "bg-background/82 backdrop-blur-xl shadow-[4px_0_24px_rgba(0,0,0,0.35)]",
          "transition-[width] duration-300 ease-out"
        )}
        style={{
          top: "max(10px, env(safe-area-inset-top, 0px))",
          left: "max(0px, env(safe-area-inset-left, 0px))",
          width: widthPx,
          maxHeight: "calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 20px)",
        }}
      >
        <div className="flex items-center justify-between gap-1 border-b border-border/20 px-1.5 py-2 shrink-0">
          {expanded && (
            <span className="pl-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Menu</span>
          )}
          <button
            type="button"
            onClick={() => setExpanded((e) => !e)}
            className="ml-auto flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-foreground/90 transition-colors hover:bg-primary/10"
            aria-label={expanded ? "Collapse menu" : "Expand menu"}
          >
            {expanded ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
          </button>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-1.5 py-2 scrollbar-hide">
          {items.map(({ id, label, icon: Icon }) => {
            const isRules = id === "rules";
            const isActive = !isRules && active === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => {
                  if (isRules) onOpenRules();
                  else onNavigate(id as AppTab);
                  if (isMobile) setExpanded(false);
                }}
                className={cn(
                  "flex items-center gap-3 rounded-xl py-3 text-left transition-all",
                  expanded ? "px-2.5" : "justify-center px-0",
                  isActive
                    ? "bg-primary/15 text-primary shadow-[inset_0_0_0_1px_hsl(var(--primary)/0.35)]"
                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground"
                )}
              >
                <div className="relative">
                  <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive && "drop-shadow-[0_0_8px_hsl(var(--primary)/0.45)]")} />
                  {!isRules && badgeTabs?.has(id) && (
                    <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-accent border border-background" />
                  )}
                </div>
                {expanded && <span className="truncate text-xs font-bold">{label}</span>}
              </button>
            );
          })}
        </nav>
      </aside>
    </>
  );
};

export default FoldableSidebar;
