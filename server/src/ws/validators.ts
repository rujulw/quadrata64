import { ERROR_CODES, type ErrorCode } from "../protocol/messages";
import type {
  BaseMessage,
  JoinRoomPayload,
  LeaveRoomPayload,
  MoveIntentPayload,
  ReadyPayload,
} from "../protocol/types";

export type IncomingMessage = BaseMessage<unknown>;

export function parseIncomingMessage(
  rawData: string,
):
  | { ok: true; message: IncomingMessage }
  | { ok: false; error: ErrorCode; message: string } {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawData);
  } catch {
    return {
      ok: false,
      error: ERROR_CODES.INVALID_JSON,
      message: "Message body must be valid JSON",
    };
  }

  if (!isMessageEnvelope(parsed)) {
    return {
      ok: false,
      error: ERROR_CODES.INVALID_ENVELOPE,
      message: "Message must include a string 'type' and optional string 'roomId'",
    };
  }

  return { ok: true, message: parsed };
}

export function validateJoinRoomPayload(
  message: IncomingMessage,
): { ok: true; payload: JoinRoomPayload } | { ok: false; message: string } {
  if (!isRecord(message.payload)) {
    return { ok: false, message: "join_room requires an object payload" };
  }

  const roomId = message.payload.roomId;
  const playerId = message.payload.playerId;
  const requestedSeat = message.payload.requestedSeat;

  if (typeof roomId !== "string" || roomId.length === 0) {
    return { ok: false, message: "join_room payload.roomId must be a non-empty string" };
  }
  if (typeof playerId !== "string" || playerId.length === 0) {
    return { ok: false, message: "join_room payload.playerId must be a non-empty string" };
  }
  if (message.roomId && message.roomId !== roomId) {
    return { ok: false, message: "join_room roomId and payload.roomId must match" };
  }
  if (
    requestedSeat !== undefined &&
    requestedSeat !== "white" &&
    requestedSeat !== "black"
  ) {
    return { ok: false, message: "join_room payload.requestedSeat must be 'white' or 'black'" };
  }

  return {
    ok: true,
    payload: {
      roomId,
      playerId,
      requestedSeat,
    },
  };
}

export function validateLeaveRoomPayload(
  message: IncomingMessage,
): { ok: true; payload: LeaveRoomPayload } | { ok: false; message: string } {
  if (!isRecord(message.payload)) {
    return { ok: false, message: "leave_room requires an object payload" };
  }

  const roomId = message.payload.roomId;
  const playerId = message.payload.playerId;
  if (typeof roomId !== "string" || roomId.length === 0) {
    return { ok: false, message: "leave_room payload.roomId must be a non-empty string" };
  }
  if (typeof playerId !== "string" || playerId.length === 0) {
    return { ok: false, message: "leave_room payload.playerId must be a non-empty string" };
  }
  if (message.roomId && message.roomId !== roomId) {
    return { ok: false, message: "leave_room roomId and payload.roomId must match" };
  }

  return {
    ok: true,
    payload: { roomId, playerId },
  };
}

export function validateReadyPayload(
  message: IncomingMessage,
): { ok: true; payload: ReadyPayload } | { ok: false; message: string } {
  if (!isRecord(message.payload)) {
    return { ok: false, message: "ready requires an object payload" };
  }

  const roomId = message.payload.roomId;
  const playerId = message.payload.playerId;
  const ready = message.payload.ready;
  if (typeof roomId !== "string" || roomId.length === 0) {
    return { ok: false, message: "ready payload.roomId must be a non-empty string" };
  }
  if (typeof playerId !== "string" || playerId.length === 0) {
    return { ok: false, message: "ready payload.playerId must be a non-empty string" };
  }
  if (typeof ready !== "boolean") {
    return { ok: false, message: "ready payload.ready must be boolean" };
  }
  if (message.roomId && message.roomId !== roomId) {
    return { ok: false, message: "ready roomId and payload.roomId must match" };
  }

  return {
    ok: true,
    payload: { roomId, playerId, ready },
  };
}

export function validateMovePayload(
  message: IncomingMessage,
): { ok: true; payload: MoveIntentPayload } | { ok: false; message: string } {
  if (!isRecord(message.payload)) {
    return { ok: false, message: "move requires an object payload" };
  }

  const roomId = message.payload.roomId;
  const playerId = message.payload.playerId;
  const move = message.payload.move;
  if (typeof roomId !== "string" || roomId.length === 0) {
    return { ok: false, message: "move payload.roomId must be a non-empty string" };
  }
  if (typeof playerId !== "string" || playerId.length === 0) {
    return { ok: false, message: "move payload.playerId must be a non-empty string" };
  }
  if (!isMoveInput(move)) {
    return {
      ok: false,
      message:
        "move payload.move must include non-empty 'from' and 'to' strings and optional promotion 'q'|'r'|'b'|'n'",
    };
  }
  if (message.roomId && message.roomId !== roomId) {
    return { ok: false, message: "move roomId and payload.roomId must match" };
  }

  return {
    ok: true,
    payload: {
      roomId,
      playerId,
      move,
    },
  };
}

function isMessageEnvelope(value: unknown): value is IncomingMessage {
  if (!isRecord(value)) {
    return false;
  }
  if (typeof value.type !== "string") {
    return false;
  }
  if ("roomId" in value && value.roomId !== undefined && typeof value.roomId !== "string") {
    return false;
  }
  return true;
}

function isMoveInput(value: unknown): value is MoveIntentPayload["move"] {
  if (!isRecord(value)) {
    return false;
  }

  const from = value.from;
  const to = value.to;
  const promotion = value.promotion;

  if (typeof from !== "string" || from.length === 0) {
    return false;
  }
  if (typeof to !== "string" || to.length === 0) {
    return false;
  }
  if (
    promotion !== undefined &&
    promotion !== "q" &&
    promotion !== "r" &&
    promotion !== "b" &&
    promotion !== "n"
  ) {
    return false;
  }

  return true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
