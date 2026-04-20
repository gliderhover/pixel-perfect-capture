import { useState, useEffect, useMemo } from "react";
import FoldableSidebar, { type AppTab } from "@/components/FoldableSidebar";
import ExploreScreen from "@/components/ExploreScreen";
import SquadScreen from "@/components/SquadScreen";
import TrainScreen from "@/components/TrainScreen";
import CompeteScreen from "@/components/CompeteScreen";
import LiveScreen from "@/components/LiveScreen";
import LeaderboardScreen from "@/components/LeaderboardScreen";
import RulesPanel from "@/components/RulesPanel";
import InstallPWAHint from "@/components/InstallPWAHint";
import OnboardingSheet, { shouldShowOnboarding } from "@/components/OnboardingSheet";
import WelcomeGiftPopup, { shouldShowGift } from "@/components/WelcomeGiftPopup";
import ContextTip, { shouldShowTip, type Tip } from "@/components/ContextTip";
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { cn } from "@/lib/utils";

const TAB_TIPS: Record<AppTab, Tip> = {
  explore: {
    id: "tip-explore",
    emoji: "🗺️",
    title: "Find players on the map",
    body: "Tap any glowing marker to challenge a player. Hit the ⬤ Scan button for AR camera mode.",
    cta: "Got it!",
  },
  train: {
    id: "tip-train",
    emoji: "💬",
    title: "Train through conversation",
    body: "Tap Motivate, Tactics, or Recovery — or type a message — to raise your player's stats each day.",
    cta: "Let's go!",
  },
  squad: {
    id: "tip-squad",
    emoji: "⭐",
    title: "Your collected players",
    body: "Tap any player card to see full stats. Collect 10 shards to evolve them to the next stage.",
    cta: "Got it!",
  },
  compete: {
    id: "tip-compete",
    emoji: "⚔️",
    title: "Challenge rivals to climb ranks",
    body: "Tap Challenge on any rival to start a matchup. Win to earn XP, Focus Points, and leaderboard position.",
    cta: "Let's compete!",
  },
  live: {
    id: "tip-live",
    emoji: "📡",
    title: "Live match feed",
    body: "Real-time events from matches happening now. Your players' morale shifts as results come in.",
    cta: "Got it!",
  },
  leaderboard: {
    id: "tip-leaderboard",
    emoji: "🏆",
    title: "Climb the leaderboard",
    body: "Your rank updates after every challenge. Train and compete daily to keep your streak alive.",
    cta: "Got it!",
  },
};

const Index = () => {
  const [activeTab, setActiveTab] = useState<AppTab>("explore");
  const [installHintVisible, setInstallHintVisible] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());
  const [showGift, setShowGift] = useState(false);
  const [activeTip, setActiveTip] = useState<Tip | null>(null);
  const { streakCount, trainedToday, recordActivity, recordTraining } = useDailyStreak();

  useEffect(() => {
    recordActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Show a contextual tip the first time each tab is visited (skip during onboarding)
  useEffect(() => {
    if (showOnboarding) return;
    const tip = TAB_TIPS[activeTab];
    if (tip && shouldShowTip(tip.id)) {
      const t = setTimeout(() => setActiveTip(tip), 800);
      return () => clearTimeout(t);
    }
  }, [activeTab, showOnboarding]);

  const badgeTabs = useMemo<ReadonlySet<string>>(
    () => new Set(trainedToday ? [] : ["train"]),
    [trainedToday]
  );

  return (
    <div
      className={cn("min-h-screen bg-background", installHintVisible && "pt-[3.25rem] sm:pt-14")}
    >
      <InstallPWAHint onVisibleChange={setInstallHintVisible} />
      <FoldableSidebar
        active={activeTab}
        onNavigate={setActiveTab}
        onOpenRules={() => setRulesOpen(true)}
        badgeTabs={badgeTabs}
      />
      <RulesPanel open={rulesOpen} onClose={() => setRulesOpen(false)} />
      {activeTab === "explore" && <ExploreScreen />}
      {activeTab === "squad" && <SquadScreen onNavigate={setActiveTab} />}
      {activeTab === "train" && <TrainScreen onTrainingComplete={recordTraining} streakCount={streakCount} />}
      {activeTab === "compete" && <CompeteScreen />}
      {activeTab === "live" && <LiveScreen />}
      {activeTab === "leaderboard" && <LeaderboardScreen />}
      {showOnboarding && (
        <OnboardingSheet onDone={() => {
          setShowOnboarding(false);
          if (shouldShowGift()) setShowGift(true);
        }} />
      )}
      {showGift && !showOnboarding && (
        <WelcomeGiftPopup onDone={() => setShowGift(false)} />
      )}
      {activeTip && !showOnboarding && (
        <ContextTip tip={activeTip} onDismiss={() => setActiveTip(null)} />
      )}
    </div>
  );
};

export default Index;
