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
import { useDailyStreak } from "@/hooks/useDailyStreak";
import { cn } from "@/lib/utils";

const Index = () => {
  const [activeTab, setActiveTab] = useState<AppTab>("explore");
  const [installHintVisible, setInstallHintVisible] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(() => shouldShowOnboarding());
  const { streakCount, trainedToday, recordActivity, recordTraining } = useDailyStreak();

  useEffect(() => {
    recordActivity();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      {showOnboarding && <OnboardingSheet onDone={() => setShowOnboarding(false)} />}
    </div>
  );
};

export default Index;
