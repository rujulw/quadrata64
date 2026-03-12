import type { CSSProperties } from "react";

export const LoaderOne = () => {
  const dots = 3;

  return (
    <div className="kinetic-loader-root" aria-label="loading" role="status">
      <div className="kinetic-loader-track">
        {[...Array(dots)].map((_, i) => (
          <div key={i} className="kinetic-dot-col">
            <div
              className="kinetic-dot-motion"
              style={{ animationDelay: `${i * 0.15}s` }}
            >
              <div
                className="kinetic-dot-body"
                style={{ animationDelay: `${i * 0.15}s` }}
              />
              <div className="kinetic-dot-shine" />
            </div>

            <div
              className="kinetic-dot-shadow"
              style={{ animationDelay: `${i * 0.15}s` }}
            />
          </div>
        ))}
      </div>
    </div>
  );
};

type MatchWaveTextProps = {
  text?: string;
};

export const MatchWaveText = ({ text = "finding match" }: MatchWaveTextProps) => {
  return (
    <p className="loader-wave-text" aria-label={text}>
      {text.split("").map((char, i) => (
        <span
          // eslint-disable-next-line react/no-array-index-key
          key={`${char}-${i}`}
          className="loader-wave-char"
          style={{ "--loader-char-delay": `${i * 0.05}s` } as CSSProperties}
        >
          {char === " " ? "\u00A0" : char}
        </span>
      ))}
    </p>
  );
};

export const MatchFoundBurst = () => {
  return (
    <div className="match-found-burst" role="status" aria-label="match found">
      <div className="match-found-track">
        <span className="match-found-dot match-found-dot-left" />
        <span className="match-found-dot match-found-dot-center" />
        <span className="match-found-dot match-found-dot-right" />
      </div>
      <span className="match-found-label">match found</span>
    </div>
  );
};
