import { useState, useEffect } from "react";
import { Camera, X, Check, MapPin, Zap } from "lucide-react";
import { useGameProgress } from "@/context/GameProgressContext";
import { rewardCameraScan } from "@/lib/apiService";

interface CameraMissionProps {
  onClose: () => void;
  onComplete: () => void;
}

const missions = [
  { text: "Find a football pitch nearby ⚽", reward: "form", fpReward: 2 },
  { text: "Spot a team crest or logo 🏟️", reward: "fanBond", fpReward: 1 },
  { text: "Capture your training ground 🌱", reward: "form", fpReward: 2 },
  { text: "Show your match-day spot 📍", reward: "confidence", fpReward: 3 },
  { text: "Scout a fan gathering area 📣", reward: "fanBond", fpReward: 2 },
  { text: "Find a pressure moment 🔥", reward: "confidence", fpReward: 2 },
];

const surfaceTags = ["Turf", "Grass", "Concrete"];
const activityTags = ["Quiet", "Active", "Crowded"];
const timeTags = ["Day", "Night"];

type Step = "camera" | "tag" | "reward";

const rewardDescriptions: Record<string, string> = {
  form: "+Form Boost",
  fanBond: "+Fan Bond",
  confidence: "+Confidence",
  morale: "+Morale",
};

const CameraMission = ({ onClose, onComplete }: CameraMissionProps) => {
  const [step, setStep] = useState<Step>("camera");
  const [missionData] = useState(() => missions[Math.floor(Math.random() * missions.length)]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [captured, setCaptured] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const { userId, activePlayer, refreshOwnedPlayers, addFocusPoints } = useGameProgress();

  const toggleTag = (tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  };

  const handleCapture = () => {
    setCaptured(true);
    setTimeout(() => setStep("tag"), 600);
  };

  const handleSubmit = () => {
    const run = async () => {
      setSubmitError(null);
      try {
        // Persist core progression rewards via backend.
        await rewardCameraScan({
          userId,
          playerId: activePlayer.id,
          zoneType: "mission",
          missionId: `camera-${Date.now()}`,
        });
        await refreshOwnedPlayers();

        // Keep FP as local session economy reward.
        addFocusPoints(missionData.fpReward);
        if (selectedTags.length >= 3) {
          addFocusPoints(1);
        }

        setStep("reward");
        setTimeout(() => {
          onComplete();
          onClose();
        }, 2500);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : "Failed to submit camera mission");
      }
    };
    void run();
  };

  return (
    <div className="fixed inset-0 z-[1400] bg-background">
      {/* Close */}
      <button onClick={onClose} className="absolute top-12 right-4 z-50 w-10 h-10 rounded-full glass-card flex items-center justify-center">
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      {step === "camera" && (
        <div className="h-full flex flex-col">
          <div className="flex-1 relative bg-muted/30 flex items-center justify-center">
            <div className="absolute inset-8 border-2 border-primary/30 rounded-3xl" />
            <div className="absolute top-4 left-0 right-0 text-center">
              <div className="inline-block glass-card-strong px-4 py-2 mx-auto">
                <p className="text-xs font-bold text-foreground">{missionData.text}</p>
              </div>
            </div>

            {/* Connected reward preview */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-2">
              <div className="glass-card px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <span className="text-sm">⭐</span>
                <span className="text-[10px] font-bold text-foreground">+25 XP</span>
              </div>
              <div className="glass-card px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <span className="text-sm">🎯</span>
                <span className="text-[10px] font-bold text-accent">+{missionData.fpReward} FP</span>
              </div>
              <div className="glass-card px-3 py-1.5 rounded-full flex items-center gap-1.5">
                <span className="text-sm">📈</span>
                <span className="text-[10px] font-bold text-primary">{rewardDescriptions[missionData.reward]}</span>
              </div>
            </div>

            {captured && (
              <div className="absolute inset-0 bg-primary/10 animate-fade-in flex items-center justify-center">
                <div className="w-20 h-20 rounded-full bg-primary/20 flex items-center justify-center animate-encounter-reveal">
                  <Check className="w-10 h-10 text-primary" />
                </div>
              </div>
            )}

            {!captured && (
              <div className="text-center">
                <Camera className="w-16 h-16 text-muted-foreground/40 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Point & capture</p>
              </div>
            )}
          </div>

          {!captured && (
            <div className="p-8 flex justify-center">
              <button
                onClick={handleCapture}
                className="w-20 h-20 rounded-full border-4 border-primary/50 flex items-center justify-center active:scale-90 transition-transform"
              >
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-primary glow-primary" />
              </button>
            </div>
          )}
        </div>
      )}

      {step === "tag" && (
        <div className="h-full flex flex-col justify-end p-6 pb-12 animate-slide-up">
          <div className="glass-card-strong p-6 rounded-3xl">
            <div className="flex items-center gap-3 mb-5">
              <div className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center">
                <MapPin className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="text-sm font-black text-foreground">Quick Tag</p>
                <p className="text-[10px] text-muted-foreground">Tag your spot for bonus rewards</p>
              </div>
            </div>

            <div className="glass-card px-3 py-2 rounded-xl mb-4 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-accent" />
              <p className="text-[10px] text-muted-foreground">
                More tags = more XP. Tag 3+ for <span className="text-accent font-bold">+1 bonus FP</span>
              </p>
            </div>
            {submitError && (
              <p className="mb-3 text-[10px] text-destructive">{submitError}</p>
            )}

            <div className="space-y-3 mb-6">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Surface</p>
                <div className="flex gap-2">
                  {surfaceTags.map((tag) => (
                    <button key={tag} onClick={() => toggleTag(tag)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        selectedTags.includes(tag)
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "glass-card text-muted-foreground"
                      }`}>{tag}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Activity</p>
                <div className="flex gap-2">
                  {activityTags.map((tag) => (
                    <button key={tag} onClick={() => toggleTag(tag)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        selectedTags.includes(tag)
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "glass-card text-muted-foreground"
                      }`}>{tag}</button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Time</p>
                <div className="flex gap-2">
                  {timeTags.map((tag) => (
                    <button key={tag} onClick={() => toggleTag(tag)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        selectedTags.includes(tag)
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "glass-card text-muted-foreground"
                      }`}>{tag}</button>
                  ))}
                </div>
              </div>
            </div>

            <button onClick={handleSubmit}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-sm floating-button glow-primary">
              Submit & Claim Reward
            </button>
          </div>
        </div>
      )}

      {step === "reward" && (
        <div className="h-full flex flex-col items-center justify-center p-6 animate-encounter-reveal">
          <div className="w-24 h-24 rounded-full bg-accent/15 flex items-center justify-center mb-6 glow-accent portrait-breathe">
            <span className="text-5xl">🎁</span>
          </div>
          <h2 className="text-2xl font-black text-foreground mb-2">Mission Complete!</h2>
          <div className="flex gap-2 mb-2">
            <span className="glass-card px-3 py-1 rounded-full text-[11px] font-bold text-foreground">
              ⭐ +{25 + selectedTags.length * 5} XP
            </span>
            <span className="glass-card px-3 py-1 rounded-full text-[11px] font-bold text-accent">
              🎯 +{missionData.fpReward + (selectedTags.length >= 3 ? 1 : 0)} FP
            </span>
            <span className="glass-card px-3 py-1 rounded-full text-[11px] font-bold text-primary">
              📈 {rewardDescriptions[missionData.reward]}
            </span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">Rewards applied to {activePlayer.name}</p>
          <div className="flex gap-2 mt-4">
            {selectedTags.map((tag) => (
              <span key={tag} className="px-3 py-1 rounded-full glass-card text-[10px] font-bold text-primary">
                {tag}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CameraMission;
