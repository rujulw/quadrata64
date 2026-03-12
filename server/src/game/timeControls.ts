import { TIME_CONTROL_IDS, type TimeControlConfig, type TimeControlId } from "./types";

export const TIME_CONTROL_PRESETS: Record<TimeControlId, TimeControlConfig> = {
  [TIME_CONTROL_IDS.BULLET]: {
    id: TIME_CONTROL_IDS.BULLET,
    initialMs: 60_000,
    incrementMs: 0,
  },
  [TIME_CONTROL_IDS.RAPID]: {
    id: TIME_CONTROL_IDS.RAPID,
    initialMs: 3 * 60_000,
    incrementMs: 0,
  },
  [TIME_CONTROL_IDS.TRADITIONAL]: {
    id: TIME_CONTROL_IDS.TRADITIONAL,
    initialMs: 10 * 60_000,
    incrementMs: 0,
  },
};

export const DEFAULT_TIME_CONTROL_ID: TimeControlId = TIME_CONTROL_IDS.RAPID;

export function getTimeControlConfig(timeControlId: TimeControlId): TimeControlConfig {
  return { ...TIME_CONTROL_PRESETS[timeControlId] };
}

