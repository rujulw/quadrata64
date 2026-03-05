import type { PlayerId, PlayerSeat, SessionId } from "../session/types";
import type {
  GameId,
  GameMoveInput,
  GamePlayerColor,
  GameResult,
  GameSnapshot,
} from "../game/types";
import type { RoomContract } from "../session/types";

export interface BaseMessage<TPayload = unknown, TType extends string = string> {
  type: TType;
  roomId?: SessionId;
  payload?: TPayload;
}

export interface JoinRoomPayload {
  roomId: SessionId;
  playerId: PlayerId;
  requestedSeat?: PlayerSeat;
}

export interface LeaveRoomPayload {
  roomId: SessionId;
  playerId: PlayerId;
}

export interface ReadyPayload {
  roomId: SessionId;
  playerId: PlayerId;
  ready: boolean;
}

export interface InitGamePayload {
  roomId: SessionId;
  gameId: GameId;
  youAre: GamePlayerColor;
  snapshot: GameSnapshot;
}

export interface MoveIntentPayload {
  roomId: SessionId;
  playerId: PlayerId;
  move: GameMoveInput;
}

export interface MoveAppliedPayload {
  roomId: SessionId;
  gameId: GameId;
  by: PlayerId;
  move: GameMoveInput;
  snapshot: GameSnapshot;
}

export interface GameOverPayload {
  roomId: SessionId;
  gameId: GameId;
  result: GameResult;
  snapshot: GameSnapshot;
}

export interface RoomStatePayload {
  roomId: SessionId;
  room: RoomContract | null;
}

export interface JoinRoomMessage extends BaseMessage<JoinRoomPayload, "join_room"> {
  roomId: SessionId;
}

export interface LeaveRoomMessage
  extends BaseMessage<LeaveRoomPayload, "leave_room"> {
  roomId: SessionId;
}

export interface ReadyMessage extends BaseMessage<ReadyPayload, "ready"> {
  roomId: SessionId;
}

export interface MoveMessage extends BaseMessage<MoveIntentPayload, "move"> {
  roomId: SessionId;
}

export interface InitGameMessage extends BaseMessage<InitGamePayload, "init_game"> {
  roomId: SessionId;
}

export interface MoveAppliedMessage
  extends BaseMessage<MoveAppliedPayload, "move_applied"> {
  roomId: SessionId;
}

export interface GameOverMessage extends BaseMessage<GameOverPayload, "game_over"> {
  roomId: SessionId;
}

export interface RoomStateMessage extends BaseMessage<RoomStatePayload, "room_state"> {
  roomId: SessionId;
}
