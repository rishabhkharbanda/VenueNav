import { useNetworkStatus } from "@/hooks/useNetworkStatus";

export function OfflineBanner() {
  const { isOnline } = useNetworkStatus();
  if (isOnline) return null;
  return (
    <div className="offline-banner" role="status">
      <span aria-hidden>✈</span> You are offline. Navigation uses the last map you opened on this device (no
      live edge updates). Reconnect to refresh.
    </div>
  );
}
