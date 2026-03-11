export const MESSAGE_TYPES = {
  JOIN_ROOM: "join_room",
  LEAVE_ROOM: "leave_room",
  READY: "ready",
  INIT_GAME: "init_game",
  MOVE_APPLIED: "move_applied",
  ROOM_STATE: "room_state",
  ERROR: "error",
  MOVE: "move",
  RESIGN: "resign",
  DRAW_OFFER: "draw_offer",
  DRAW_ACCEPT: "draw_accept",
  DRAW_DECLINE: "draw_decline",
  DRAW_OFFERED: "draw_offered",
  DRAW_DECLINED: "draw_declined",
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
  GAME_NOT_FOUND: "game_not_found",
  GAME_ALREADY_FINISHED: "game_already_finished",
  ILLEGAL_MOVE: "illegal_move",
  WRONG_TURN_PLAYER: "wrong_turn_player",
  DRAW_ALREADY_OFFERED: "draw_already_offered",
  DRAW_NOT_OFFERED: "draw_not_offered",
  DRAW_CANNOT_ACCEPT_OWN_OFFER: "draw_cannot_accept_own_offer",
  DRAW_CANNOT_DECLINE_OWN_OFFER: "draw_cannot_decline_own_offer",
  NOT_IMPLEMENTED: "not_implemented",
} as const;

export type ErrorCode = (typeof ERROR_CODES)[keyof typeof ERROR_CODES];
