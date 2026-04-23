import { useEffect } from "react";
import { useNavStore } from "@/store/navStore";

export function useNetworkStatus(): { isOnline: boolean; isOffline: boolean } {
  const isOnline = useNavStore((s) => s.isOnline);
  const setIsOnline = useNavStore((s) => s.setIsOnline);

  useEffect(() => {
    // Single function identity for add and remove to avoid any listener / cleanup mismatch.
    const handleChange = () => {
      setIsOnline(typeof navigator !== "undefined" ? navigator.onLine : true);
    };
    handleChange();
    window.addEventListener("online", handleChange);
    window.addEventListener("offline", handleChange);
    return () => {
      window.removeEventListener("online", handleChange);
      window.removeEventListener("offline", handleChange);
    };
  }, [setIsOnline]);

  return { isOnline, isOffline: !isOnline };
}
