import type { PlayerId, PlayerSeat, SessionId } from "../session/types";

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
