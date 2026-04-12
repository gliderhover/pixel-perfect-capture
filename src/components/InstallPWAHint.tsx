import { X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

/** iPhone / iPod (not iPad), for copy that says "your iPhone". */
function isIPhone(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPhone|iPod/.test(navigator.userAgent);
}

/**
 * Likely Mobile Safari on iPhone — WebKit, not Chrome/Firefox/Edge/Opera/embedded in-app browsers on iOS.
 */
function isIPhoneSafari(): boolean {
  if (!isIPhone()) return false;
  const ua = navigator.userAgent;
  if (!/Safari/i.test(ua)) return false;
  if (/CriOS|FxiOS|EdgiOS|OPiOS|OPT\/|GSA\/|FBAN|FBAV|Instagram|Line\//i.test(ua)) {
    return false;
  }
  return true;
}

function isStandaloneDisplay(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia("(display-mode: standalone)").matches) return true;
  return (window.navigator as Navigator & { standalone?: boolean }).standalone === true;
}

const DISMISS_KEY = "pwa-install-hint-dismissed";

interface InstallPWAHintProps {
  onVisibleChange?: (visible: boolean) => void;
}

const InstallPWAHint = ({ onVisibleChange }: InstallPWAHintProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isIPhoneSafari() || isStandaloneDisplay()) {
      onVisibleChange?.(false);
      return;
    }
    if (localStorage.getItem(DISMISS_KEY) === "1") {
      onVisibleChange?.(false);
      return;
    }
    setVisible(true);
    onVisibleChange?.(true);
  }, [onVisibleChange]);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, "1");
    setVisible(false);
    onVisibleChange?.(false);
  };

  if (!visible) return null;

  return (
    <div
      className="fixed left-0 right-0 top-0 z-[1250] border-b border-border/30 bg-card/95 px-3 py-2 shadow-sm backdrop-blur-md"
      style={{ paddingTop: "max(0.375rem, env(safe-area-inset-top))" }}
      role="status"
    >
      <div className="mx-auto flex max-w-md items-center gap-2">
        <p className="min-w-0 flex-1 text-center text-[13px] leading-snug text-muted-foreground">
          Install this app on your iPhone: tap{" "}
          <span className="font-medium text-foreground">Share</span>, then{" "}
          <span className="font-medium text-foreground">Add to Home Screen</span>.
        </p>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="h-7 w-7 shrink-0 rounded-full text-muted-foreground hover:bg-secondary hover:text-foreground"
          onClick={dismiss}
          aria-label="Dismiss install hint"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
};

export default InstallPWAHint;
