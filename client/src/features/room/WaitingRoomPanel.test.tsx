import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { WaitingRoomPanel } from "./WaitingRoomPanel";

describe("WaitingRoomPanel", () => {
  it("renders ready-up state when player can ready", () => {
    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        onResign={vi.fn()}
        onOfferDraw={vi.fn()}
        onAcceptDraw={vi.fn()}
        onDeclineDraw={vi.fn()}
        isMatching={false}
        isReady={false}
        canReady
        canResign
        canOfferDraw
        canAcceptDraw={false}
        canDeclineDraw={false}
        roomPhase="waiting"
        gameTurn="white"
        gameStatus="active"
        terminalResultLabel={null}
        drawOfferLabel={null}
        moveFeed={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "ready up" })).toBeEnabled();
  });

  it("dispatches ready toggle when ready button is clicked", async () => {
    const onToggleReady = vi.fn();
    const user = userEvent.setup();

    render(
      <WaitingRoomPanel
        onToggleReady={onToggleReady}
        onResign={vi.fn()}
        onOfferDraw={vi.fn()}
        onAcceptDraw={vi.fn()}
        onDeclineDraw={vi.fn()}
        isMatching={false}
        isReady={false}
        canReady
        canResign
        canOfferDraw
        canAcceptDraw={false}
        canDeclineDraw={false}
        roomPhase="waiting"
        gameTurn="white"
        gameStatus="active"
        terminalResultLabel={null}
        drawOfferLabel={null}
        moveFeed={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "ready up" }));

    expect(onToggleReady).toHaveBeenCalledTimes(1);
  });

  it("renders queued loader state while waiting for opponent", () => {
    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        onResign={vi.fn()}
        onOfferDraw={vi.fn()}
        onAcceptDraw={vi.fn()}
        onDeclineDraw={vi.fn()}
        isMatching
        isReady
        canReady
        canResign={false}
        canOfferDraw={false}
        canAcceptDraw={false}
        canDeclineDraw={false}
        roomPhase="waiting"
        gameTurn="white"
        gameStatus="active"
        terminalResultLabel={null}
        drawOfferLabel={null}
        moveFeed={[]}
      />,
    );

    expect(screen.getByLabelText("finding match")).toBeInTheDocument();
    expect(screen.getByLabelText("loading")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "queued" })).toBeEnabled();
  });

  it("renders match face when room is active", () => {
    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        onResign={vi.fn()}
        onOfferDraw={vi.fn()}
        onAcceptDraw={vi.fn()}
        onDeclineDraw={vi.fn()}
        isMatching={false}
        isReady
        canReady
        canResign
        canOfferDraw
        canAcceptDraw={false}
        canDeclineDraw={false}
        roomPhase="active"
        gameTurn="black"
        gameStatus="active"
        terminalResultLabel={null}
        drawOfferLabel={null}
        moveFeed={[]}
      />,
    );

    expect(screen.queryByRole("button", { name: "unready" })).not.toBeInTheDocument();
    expect(screen.getByText("black to move")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "offer draw" })).toBeEnabled();
  });

  it("disables actions when player has no seat", () => {
    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        onResign={vi.fn()}
        onOfferDraw={vi.fn()}
        onAcceptDraw={vi.fn()}
        onDeclineDraw={vi.fn()}
        isMatching={false}
        isReady={false}
        canReady={false}
        canResign={false}
        canOfferDraw={false}
        canAcceptDraw={false}
        canDeclineDraw={false}
        roomPhase="waiting"
        gameTurn="white"
        gameStatus="active"
        terminalResultLabel={null}
        drawOfferLabel={null}
        moveFeed={[]}
      />,
    );

    expect(screen.getByRole("button", { name: "ready up" })).toBeDisabled();
    expect(screen.getByRole("combobox", { name: /time control/i })).toBeDisabled();
  });

  it("renders draw response controls and dispatches draw accept", async () => {
    const onAcceptDraw = vi.fn();
    const user = userEvent.setup();

    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        onResign={vi.fn()}
        onOfferDraw={vi.fn()}
        onAcceptDraw={onAcceptDraw}
        onDeclineDraw={vi.fn()}
        isMatching={false}
        isReady
        canReady
        canResign
        canOfferDraw={false}
        canAcceptDraw
        canDeclineDraw
        roomPhase="active"
        gameTurn="black"
        gameStatus="active"
        terminalResultLabel={null}
        drawOfferLabel="white offered draw"
        moveFeed={[]}
      />,
    );

    expect(screen.getByText("white offered draw")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "accept draw" }));
    expect(onAcceptDraw).toHaveBeenCalledTimes(1);
  });

  it("dispatches draw offer when no pending offer exists", async () => {
    const onOfferDraw = vi.fn();
    const user = userEvent.setup();

    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        onResign={vi.fn()}
        onOfferDraw={onOfferDraw}
        onAcceptDraw={vi.fn()}
        onDeclineDraw={vi.fn()}
        isMatching={false}
        isReady
        canReady
        canResign
        canOfferDraw
        canAcceptDraw={false}
        canDeclineDraw={false}
        roomPhase="active"
        gameTurn="white"
        gameStatus="active"
        terminalResultLabel={null}
        drawOfferLabel={null}
        moveFeed={[]}
      />,
    );

    await user.click(screen.getByRole("button", { name: "offer draw" }));
    expect(onOfferDraw).toHaveBeenCalledTimes(1);
  });

  it("shows draw response controls instead of offer button when pending offer exists", () => {
    render(
      <WaitingRoomPanel
        onToggleReady={vi.fn()}
        onResign={vi.fn()}
        onOfferDraw={vi.fn()}
        onAcceptDraw={vi.fn()}
        onDeclineDraw={vi.fn()}
        isMatching={false}
        isReady
        canReady
        canResign
        canOfferDraw={false}
        canAcceptDraw
        canDeclineDraw
        roomPhase="active"
        gameTurn="black"
        gameStatus="active"
        terminalResultLabel={null}
        drawOfferLabel="white offered draw"
        moveFeed={[]}
      />,
    );

    expect(screen.queryByRole("button", { name: "offer draw" })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: "accept draw" })).toBeEnabled();
    expect(screen.getByRole("button", { name: "decline draw" })).toBeEnabled();
  });
});
