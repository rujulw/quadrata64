export default function App() {
  const cells = Array.from({ length: 64 }, (_, index) => {
    const row = Math.floor(index / 8);
    const col = index % 8;
    const isLight = (row + col) % 2 === 0;

    return (
      <div
        key={index}
        className={`board-cell ${isLight ? "board-cell-light" : "board-cell-dark"}`}
      />
    );
  });

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-6xl place-items-center px-5 py-10 sm:px-8">
      <section className="ui-shell w-full p-5 sm:p-8">
        <header className="mb-8 flex items-center justify-between">
        </header>

        <div className="grid gap-1 lg:grid-cols-[1.25fr_1fr] lg:items-center">
          <div>
            <h1 className="title-display text-3xl font-semibold leading-tight sm:text-4xl">
              quadrata64 ui dev in progress
            </h1>
          </div>

          <div className="board-frame">
            <div className="board-grid">{cells}</div>
          </div>
        </div>
      </section>
    </main>
  );
}
