export type SessionId = string;
export type PlayerId = string;

export const ROOM_STATES = {
  WAITING: "waiting",
  ACTIVE: "active",
  CLOSED: "closed",
} as const;

export type RoomState = (typeof ROOM_STATES)[keyof typeof ROOM_STATES];

export const PLAYER_SLOTS = {
  WHITE: "white",
  BLACK: "black",
  SPECTATOR: "spectator",
} as const;

export type PlayerSlot = (typeof PLAYER_SLOTS)[keyof typeof PLAYER_SLOTS];

export type PlayerSeat = Exclude<PlayerSlot, "spectator">;

export interface RoomParticipant {
  playerId: PlayerId;
  slot: PlayerSlot;
  ready: boolean;
  connected: boolean;
  joinedAt: number;
}

export interface RoomContract {
  sessionId: SessionId;
  state: RoomState;
  seats: {
    white: PlayerId | null;
    black: PlayerId | null;
  };
  spectators: PlayerId[];
  participants: RoomParticipant[];
  createdAt: number;
  updatedAt: number;
}
