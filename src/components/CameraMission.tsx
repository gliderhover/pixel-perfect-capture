import { useState, useEffect } from "react";
import { Camera, X, Check, MapPin } from "lucide-react";

interface CameraMissionProps {
  onClose: () => void;
  onComplete: () => void;
}

const missions = [
  "Find a football pitch nearby ⚽",
  "Spot a team crest or logo 🏟️",
  "Capture your training ground 🌱",
  "Show your match-day spot 📍",
];

const surfaceTags = ["Turf", "Grass", "Concrete"];
const activityTags = ["Quiet", "Active", "Crowded"];
const timeTags = ["Day", "Night"];

type Step = "camera" | "tag" | "reward";

const CameraMission = ({ onClose, onComplete }: CameraMissionProps) => {
  const [step, setStep] = useState<Step>("camera");
  const [mission] = useState(missions[Math.floor(Math.random() * missions.length)]);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [captured, setCaptured] = useState(false);

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
    setStep("reward");
    setTimeout(() => {
      onComplete();
      onClose();
    }, 2000);
  };

  return (
    <div className="fixed inset-0 z-[1400] bg-background">
      {/* Close */}
      <button onClick={onClose} className="absolute top-12 right-4 z-50 w-10 h-10 rounded-full glass-card flex items-center justify-center">
        <X className="w-5 h-5 text-muted-foreground" />
      </button>

      {step === "camera" && (
        <div className="h-full flex flex-col">
          {/* Simulated camera viewfinder */}
          <div className="flex-1 relative bg-muted/30 flex items-center justify-center">
            <div className="absolute inset-8 border-2 border-primary/30 rounded-3xl" />
            <div className="absolute top-4 left-0 right-0 text-center">
              <div className="inline-block glass-card-strong px-4 py-2 mx-auto">
                <p className="text-xs font-bold text-foreground">{mission}</p>
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

          {/* Capture button */}
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
                <p className="text-[10px] text-muted-foreground">Optional — tap to tag your spot</p>
              </div>
            </div>

            {/* Tag groups */}
            <div className="space-y-3 mb-6">
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Surface</p>
                <div className="flex gap-2">
                  {surfaceTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        selectedTags.includes(tag)
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "glass-card text-muted-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Activity</p>
                <div className="flex gap-2">
                  {activityTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        selectedTags.includes(tag)
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "glass-card text-muted-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold mb-2">Time</p>
                <div className="flex gap-2">
                  {timeTags.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => toggleTag(tag)}
                      className={`px-4 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                        selectedTags.includes(tag)
                          ? "bg-primary/15 text-primary border border-primary/30"
                          : "glass-card text-muted-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <button
              onClick={handleSubmit}
              className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-primary text-primary-foreground font-black text-sm floating-button glow-primary"
            >
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
          <p className="text-sm text-muted-foreground mb-1">+25 XP • +2 Fan Bond</p>
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
