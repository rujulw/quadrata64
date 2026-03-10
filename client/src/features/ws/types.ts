import type { GameSnapshot } from "../board/types";
import type { RoomSnapshot } from "../room/types";

export type ClientIntentType = "join_room" | "leave_room" | "ready" | "move";

export type ClientIntentEnvelope = {
  type: ClientIntentType;
  roomId: string;
  payload: Record<string, unknown>;
};

export type SyncConnectionStatus = "idle" | "connecting" | "open" | "closed";

export type SyncConfig = {
  roomId: string;
  playerId: string;
};

export type SyncState = {
  status: SyncConnectionStatus;
  room: RoomSnapshot | null;
  game: GameSnapshot | null;
  errorMessage: string | null;
};

export type SyncActions = {
  connect: () => void;
  disconnect: () => void;
  sendIntent: (intent: ClientIntentEnvelope) => void;
  toggleReadyIntent: (roomId: string, playerId: string, ready: boolean) => void;
};
