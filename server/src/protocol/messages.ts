export const MESSAGE_TYPES = {
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  READY: "ready",
  INIT_GAME: "init_game",
  ROOM_STATE: "room_state",
  ERROR: "error",
  MOVE: "move",
  GAME_OVER: "game_over",
} as const;

export type MessageType =
  (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];

export const ERROR_CODES = {
  INVALID_JSON: "invalid_json",
  INVALID_ENVELOPE: "invalid_envelope",
  INVALID_PAYLOAD: "invalid_payload",
  UNSUPPORTED_MESSAGE_TYPE: "unsupported_message_type",
  SOCKET_ALREADY_ASSIGNED: "socket_already_assigned",
  SOCKET_NOT_ASSIGNED: "socket_not_assigned",
  NOT_IMPLEMENTED: "not_implemented",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
