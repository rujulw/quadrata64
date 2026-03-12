import { fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

import { BoardSurface } from "./BoardSurface";

const START_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const PROMOTION_FEN = "k7/4P3/8/8/8/8/8/7K w - - 0 1";

function makeSnapshot(fen: string = START_FEN) {
  return {
    fen,
    turn: "white" as const,
    moveCount: 0,
    status: "active" as const,
    drawOfferBy: null,
    lastMove: null,
    result: null,
  };
}

describe("BoardSurface", () => {
  it("dispatches move intent for a legal move path", async () => {
    const onMoveIntent = vi.fn();
    const user = userEvent.setup();

    render(
      <BoardSurface
        snapshot={makeSnapshot()}
        orientation="white"
        playerColor="white"
        onMoveIntent={onMoveIntent}
      />,
    );

    await user.click(screen.getByRole("button", { name: "e2" }));
    await user.click(screen.getByRole("button", { name: "e4" }));

    expect(onMoveIntent).toHaveBeenCalledTimes(1);
    expect(onMoveIntent).toHaveBeenCalledWith({ from: "e2", to: "e4", promotion: undefined });
  });

  it("does not dispatch when destination is illegal", async () => {
    const onMoveIntent = vi.fn();
    const user = userEvent.setup();

    render(
      <BoardSurface
        snapshot={makeSnapshot()}
        orientation="white"
        playerColor="white"
        onMoveIntent={onMoveIntent}
      />,
    );

    await user.click(screen.getByRole("button", { name: "e2" }));
    await user.click(screen.getByRole("button", { name: "e5" }));

    expect(onMoveIntent).not.toHaveBeenCalled();
  });

  it("dispatches move intent when piece is dragged to a legal square", () => {
    const onMoveIntent = vi.fn();

    render(
      <BoardSurface
        snapshot={makeSnapshot()}
        orientation="white"
        playerColor="white"
        onMoveIntent={onMoveIntent}
      />,
    );

    const from = screen.getByRole("button", { name: "e2" });
    const piece = within(from).getByRole("img", { name: "white p" });
    const to = screen.getByRole("button", { name: "e4" });

    fireEvent.mouseDown(piece);
    fireEvent.mouseEnter(to);
    fireEvent.mouseUp(to);

    expect(onMoveIntent).toHaveBeenCalledTimes(1);
    expect(onMoveIntent).toHaveBeenCalledWith({ from: "e2", to: "e4", promotion: undefined });
  });

  it("does not dispatch move intent when dragged to illegal square", () => {
    const onMoveIntent = vi.fn();

    render(
      <BoardSurface
        snapshot={makeSnapshot()}
        orientation="white"
        playerColor="white"
        onMoveIntent={onMoveIntent}
      />,
    );

    const from = screen.getByRole("button", { name: "e2" });
    const piece = within(from).getByRole("img", { name: "white p" });
    const to = screen.getByRole("button", { name: "e5" });
    fireEvent.mouseDown(piece);
    fireEvent.mouseEnter(to);
    fireEvent.mouseUp(to);

    expect(onMoveIntent).not.toHaveBeenCalled();
  });

  it("cancels current selection on Escape", async () => {
    const onMoveIntent = vi.fn();
    const user = userEvent.setup();

    const { container } = render(
      <BoardSurface
        snapshot={makeSnapshot()}
        orientation="white"
        playerColor="white"
        onMoveIntent={onMoveIntent}
      />,
    );

    await user.click(screen.getByRole("button", { name: "e2" }));
    fireEvent.keyDown(container.querySelector("section")!, { key: "Escape" });
    await user.click(screen.getByRole("button", { name: "e4" }));

    expect(onMoveIntent).not.toHaveBeenCalled();
  });

  it("toggles planning square highlight on right-click drag start/end on same square", () => {
    render(<BoardSurface snapshot={makeSnapshot()} orientation="white" playerColor="white" onMoveIntent={vi.fn()} />);

    const square = screen.getByRole("button", { name: "e4" });
    fireEvent.mouseDown(square, { button: 2, clientX: 100, clientY: 100 });
    fireEvent.mouseUp(square, { button: 2, clientX: 100, clientY: 100 });

    expect(screen.getByTestId("board-root").querySelector('[data-plan-highlight="e4"]')).not.toBeNull();

    fireEvent.mouseDown(square, { button: 2, clientX: 100, clientY: 100 });
    fireEvent.mouseUp(square, { button: 2, clientX: 100, clientY: 100 });

    expect(screen.getByTestId("board-root").querySelector('[data-plan-highlight="e4"]')).toBeNull();
  });

  it("does not make board squares draggable", () => {
    render(
      <BoardSurface
        snapshot={makeSnapshot()}
        orientation="white"
        playerColor="white"
        onMoveIntent={vi.fn()}
      />,
    );

    expect(screen.getByRole("button", { name: "e2" })).toHaveAttribute("draggable", "false");
  });

  it("adds and removes planning arrows via right-click drag", () => {
    render(<BoardSurface snapshot={makeSnapshot()} orientation="white" playerColor="white" onMoveIntent={vi.fn()} />);

    const from = screen.getByRole("button", { name: "e2" });
    const to = screen.getByRole("button", { name: "e4" });
    fireEvent.mouseDown(from, { button: 2, clientX: 100, clientY: 100 });
    fireEvent.mouseEnter(to);
    fireEvent.mouseUp(to, { button: 2, clientX: 120, clientY: 120 });

    expect(screen.getByTestId("board-root").querySelector('[data-plan-arrow="e2-e4"]')).not.toBeNull();

    fireEvent.mouseDown(from, { button: 2, clientX: 100, clientY: 100 });
    fireEvent.mouseEnter(to);
    fireEvent.mouseUp(to, { button: 2, clientX: 120, clientY: 120 });

    expect(screen.getByTestId("board-root").querySelector('[data-plan-arrow="e2-e4"]')).toBeNull();
  });

  it("shows drag-start visual state after pointer moves past threshold", () => {
    const { container } = render(
      <BoardSurface snapshot={makeSnapshot()} orientation="white" playerColor="white" onMoveIntent={vi.fn()} />,
    );

    const from = screen.getByRole("button", { name: "e2" });
    const piece = within(from).getByRole("img", { name: "white p" });

    fireEvent.mouseDown(piece, { clientX: 20, clientY: 20 });
    fireEvent.mouseMove(window, { clientX: 30, clientY: 30 });

    expect(piece.className).toContain("opacity-0");
    expect(container.querySelector('img[aria-hidden="true"]')).not.toBeNull();
  });

  it("handles promotion path with queen promotion intent", async () => {
    const onMoveIntent = vi.fn();
    const user = userEvent.setup();

    render(
      <BoardSurface
        snapshot={makeSnapshot(PROMOTION_FEN)}
        orientation="white"
        playerColor="white"
        onMoveIntent={onMoveIntent}
      />,
    );

    await user.click(screen.getByRole("button", { name: "e7" }));
    await user.click(screen.getByRole("button", { name: "e8" }));

    expect(onMoveIntent).toHaveBeenCalledTimes(1);
    expect(onMoveIntent).toHaveBeenCalledWith({ from: "e7", to: "e8", promotion: "q" });
  });
});
