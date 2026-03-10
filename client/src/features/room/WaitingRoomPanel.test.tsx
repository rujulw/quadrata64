import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WaitingRoomPanel } from "./WaitingRoomPanel";

describe("WaitingRoomPanel", () => {
  it("renders ready-up state when player can ready", () => {
    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        isMatching={false}
        isReady={false}
        canReady
        roomPhase="waiting"
      />,
    );

    expect(screen.getByRole("button", { name: "ready up" })).toBeEnabled();
    expect(screen.getByText("phase: waiting")).toBeInTheDocument();
  });

  it("dispatches ready toggle when ready button is clicked", async () => {
    const onToggleReady = vi.fn();
    const user = userEvent.setup();

    render(
      <WaitingRoomPanel
        onToggleReady={onToggleReady}
        isMatching={false}
        isReady={false}
        canReady
        roomPhase="waiting"
      />,
    );

    await user.click(screen.getByRole("button", { name: "ready up" }));

    expect(onToggleReady).toHaveBeenCalledTimes(1);
  });

  it("renders queued loader state while waiting for opponent", () => {
    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        isMatching
        isReady
        canReady
        roomPhase="waiting"
      />,
    );

    expect(screen.getByText("matching...")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "queued" })).toBeEnabled();
  });

  it("renders unready state when room is active", () => {
    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        isMatching={false}
        isReady
        canReady
        roomPhase="active"
      />,
    );

    expect(screen.getByRole("button", { name: "unready" })).toBeEnabled();
    expect(screen.getByText("phase: active")).toBeInTheDocument();
  });

  it("disables actions when player has no seat", () => {
    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        isMatching={false}
        isReady={false}
        canReady={false}
        roomPhase="waiting"
      />,
    );

    expect(screen.getByRole("button", { name: "ready up" })).toBeDisabled();
    expect(screen.getByRole("button", { name: /rapid - 3 min/i })).toBeDisabled();
  });
});
