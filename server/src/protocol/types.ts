export interface BaseMessage<T = unknown> {
  type: string;
  roomId?: string;
  payload?: T;
}