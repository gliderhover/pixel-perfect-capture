import { useState } from "react";
import BottomNav from "@/components/BottomNav";
import ExploreScreen from "@/components/ExploreScreen";
import SquadScreen from "@/components/SquadScreen";
import TrainScreen from "@/components/TrainScreen";
import CompeteScreen from "@/components/CompeteScreen";
import LiveScreen from "@/components/LiveScreen";
import InstallPWAHint from "@/components/InstallPWAHint";
import { cn } from "@/lib/utils";

type Tab = "explore" | "squad" | "train" | "compete" | "live";

const Index = () => {
  const [activeTab, setActiveTab] = useState<Tab>("explore");
  const [installHintVisible, setInstallHintVisible] = useState(false);

  return (
    <div
      className={cn("min-h-screen bg-background", installHintVisible && "pt-[3.25rem] sm:pt-14")}
    >
      <InstallPWAHint onVisibleChange={setInstallHintVisible} />
      {activeTab === "explore" && <ExploreScreen />}
      {activeTab === "squad" && <SquadScreen />}
      {activeTab === "train" && <TrainScreen />}
      {activeTab === "compete" && <CompeteScreen />}
      {activeTab === "live" && <LiveScreen />}
      <BottomNav activeTab={activeTab} onTabChange={setActiveTab} />
    </div>
  );
};

export default Index;
