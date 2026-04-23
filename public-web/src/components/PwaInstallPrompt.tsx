import { useCallback, useEffect, useState } from "react";

type BeforeInstall = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

export function PwaInstallPrompt() {
  const [event, setEvent] = useState<BeforeInstall | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const onBip = (e: Event) => {
      e.preventDefault();
      setEvent(e as BeforeInstall);
    };
    window.addEventListener("beforeinstallprompt", onBip);
    return () => window.removeEventListener("beforeinstallprompt", onBip);
  }, []);

  const onInstall = useCallback(async () => {
    if (!event) return;
    try {
      await event.prompt();
      await event.userChoice;
    } catch {
      /* */
    } finally {
      setDismissed(true);
    }
  }, [event]);

  if (dismissed || !event) return null;

  return (
    <div className="pwa-install" role="region" aria-label="Install app">
      <span>Install VenueNav for a full-screen app and faster loads.</span>
      <div className="pwa-install-actions">
        <button
          type="button"
          className="btn small primary"
          onClick={() => void onInstall()}
        >
          Install
        </button>
        <button type="button" className="btn link" onClick={() => setDismissed(true)}>
          Dismiss
        </button>
      </div>
    </div>
  );
}
