import { useCallback, useMemo, useState } from "react";

import type { SyncActions, SyncState, ClientIntentEnvelope } from "./types";

const initialState: SyncState = {
  status: "idle",
  room: null,
  game: null,
  errorMessage: null,
};

export function useWsSync(): SyncState & SyncActions {
  const [state, setState] = useState<SyncState>(initialState);

  const connect = useCallback(() => {
    setState((prev) => ({ ...prev, status: "open", errorMessage: null }));
  }, []);

  const disconnect = useCallback(() => {
    setState((prev) => ({ ...prev, status: "closed" }));
  }, []);

  const sendIntent = useCallback((intent: ClientIntentEnvelope) => {
    setState((prev) => ({
      ...prev,
      errorMessage: intent.type === "move" && !prev.game ? "No active game snapshot yet." : null,
    }));
  }, []);

  const toggleReadyIntent = useCallback(
    (roomId: string, peerId: string, isReady: boolean) => {
      sendIntent({
        type: "ready",
        roomId,
        payload: {
          peerId,
          isReady,
        },
      });
    },
    [sendIntent],
  );

  return useMemo(
    () => ({
      ...state,
      connect,
      disconnect,
      sendIntent,
      toggleReadyIntent,
    }),
    [state, connect, disconnect, sendIntent, toggleReadyIntent],
  );
}
