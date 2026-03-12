export type RoomPhase = "waiting" | "active";

export type RoomSeat = {
  peerId: string;
  isReady: boolean;
};

export type RoomSnapshot = {
  roomId: string;
  phase: RoomPhase;
  timeControl: "bullet" | "rapid" | "traditional";
  white: RoomSeat | null;
  black: RoomSeat | null;
  spectatorCount: number;
};
