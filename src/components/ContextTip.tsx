import { useState, useEffect } from "react";
import { X } from "lucide-react";

export interface Tip {
  id: string;
  title: string;
  body: string;
  cta?: string;
  emoji: string;
}

const SEEN_KEY = "ppc-seen-tips";

function getSeenTips(): Set<string> {
  try {
    const raw = localStorage.getItem(SEEN_KEY);
    return new Set(raw ? JSON.parse(raw) : []);
  } catch {
    return new Set();
  }
}

function markTipSeen(id: string) {
  const seen = getSeenTips();
  seen.add(id);
  localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
}

export function shouldShowTip(id: string): boolean {
  return !getSeenTips().has(id);
}

interface ContextTipProps {
  tip: Tip;
  onDismiss: () => void;
}

const ContextTip = ({ tip, onDismiss }: ContextTipProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 600);
    return () => clearTimeout(t);
  }, []);

  const dismiss = () => {
    markTipSeen(tip.id);
    setVisible(false);
    setTimeout(onDismiss, 300);
  };

  return (
    <div
      className={`fixed bottom-[calc(env(safe-area-inset-bottom,0px)+80px)] left-4 right-4 z-[1800] transition-all duration-300 ${
        visible ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
      }`}
    >
      <div className="glass-card-strong rounded-2xl px-4 py-3.5 border border-primary/25 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
        <div className="flex items-start gap-3">
          <span className="text-2xl shrink-0 mt-0.5">{tip.emoji}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-black text-foreground mb-0.5">{tip.title}</p>
            <p className="text-[10px] text-muted-foreground leading-relaxed">{tip.body}</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            className="shrink-0 w-6 h-6 flex items-center justify-center rounded-full hover:bg-muted/60 transition-colors mt-0.5"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
        {tip.cta && (
          <button
            type="button"
            onClick={dismiss}
            className="mt-2.5 w-full py-2 rounded-xl bg-primary/15 text-primary text-[10px] font-black border border-primary/25 active:scale-[0.98] transition-transform"
          >
            {tip.cta}
          </button>
        )}
      </div>
    </div>
  );
};

export default ContextTip;
