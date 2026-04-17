import { useState } from "react";

const ONBOARD_KEY = "ppc-onboarded";

const slides = [
  {
    emoji: "🗺️",
    title: "Find Your Player",
    body: "Explore the North America map. Tap any player marker — or hit the Scan button — to challenge them to a penalty duel.",
  },
  {
    emoji: "⚽",
    title: "Win the Penalty Duel",
    body: "Watch the ball fly and swipe left, right, or tap center to dive. Save the shot and that player joins your squad.",
  },
  {
    emoji: "💬",
    title: "Train Daily",
    body: "Chat with your players every day. Your words raise their Confidence, Form, Morale, and Fan Bond. Come back tomorrow.",
  },
];

interface OnboardingSheetProps {
  onDone: () => void;
}

const OnboardingSheet = ({ onDone }: OnboardingSheetProps) => {
  const [slide, setSlide] = useState(0);
  const isLast = slide === slides.length - 1;

  const advance = () => {
    if (isLast) {
      localStorage.setItem(ONBOARD_KEY, "1");
      onDone();
    } else {
      setSlide((s) => s + 1);
    }
  };

  const skip = () => {
    localStorage.setItem(ONBOARD_KEY, "1");
    onDone();
  };

  return (
    <div className="fixed inset-0 z-[2000] bg-background/80 backdrop-blur-sm flex items-end">
      <div className="w-full bg-card border-t border-border/30 rounded-t-3xl p-6 pb-10 animate-slide-up">
        <div className="flex justify-center gap-1.5 mb-6">
          {slides.map((_, i) => (
            <div
              key={i}
              className={`h-1.5 rounded-full transition-all duration-300 ${
                i === slide ? "w-6 bg-primary" : "w-1.5 bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="text-center mb-8">
          <div className="text-6xl mb-4">{slides[slide].emoji}</div>
          <h2 className="text-2xl font-black text-foreground mb-3">{slides[slide].title}</h2>
          <p className="text-sm text-muted-foreground leading-relaxed max-w-xs mx-auto">
            {slides[slide].body}
          </p>
        </div>
        <button
          type="button"
          onClick={advance}
          className="w-full py-4 rounded-2xl bg-gradient-to-r from-primary to-emerald-400 text-primary-foreground font-black text-sm floating-button glow-primary"
        >
          {isLast ? "Let's Go ⚡" : "Next →"}
        </button>
        {!isLast && (
          <button
            type="button"
            onClick={skip}
            className="w-full py-3 text-xs text-muted-foreground mt-1"
          >
            Skip
          </button>
        )}
      </div>
    </div>
  );
};

export const shouldShowOnboarding = (): boolean =>
  !localStorage.getItem(ONBOARD_KEY);

export default OnboardingSheet;
