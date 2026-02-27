export const MESSAGE_TYPES = {
  INIT_GAME: "init_game",
  MOVE: "move",
  GAME_OVER: "game_over",
} as const;

export type MessageType =
  (typeof MESSAGE_TYPES)[keyof typeof MESSAGE_TYPES];