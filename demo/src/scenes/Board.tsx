import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { Fade, Line } from "../components";

interface Thread {
  name: string;
  title: string;
  color: string;
  win: [number, number]; // progress fills over [from, to] frames
}

const THREADS: Thread[] = [
  { name: "web", title: "Web app", color: theme.cyan, win: [10, 150] },
  { name: "api", title: "API + DB", color: theme.accent, win: [20, 178] },
  { name: "docs", title: "Docs site", color: theme.green, win: [14, 132] },
];

function phaseOf(pct: number): string {
  if (pct >= 100) return "done";
  if (pct >= 82) return "qa";
  if (pct >= 6) return "build";
  return "pending";
}

const Tile: React.FC<{ t: Thread }> = ({ t }) => {
  const frame = useCurrentFrame();
  const pct = Math.round(
    interpolate(frame, t.win, [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
  );
  const phase = phaseOf(pct);
  const done = phase === "done";
  const border = done ? theme.green : t.color;
  return (
    <div
      style={{
        background: theme.panel,
        border: `1px solid ${theme.line}`,
        borderLeft: `4px solid ${border}`,
        borderRadius: 12,
        padding: "16px 18px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ color: t.color, fontWeight: 800, fontSize: 24 }}>{t.name}</span>
        <span style={{ color: theme.dim, fontSize: 16, textTransform: "uppercase", letterSpacing: 1 }}>
          {phase}
        </span>
        {done && <span style={{ marginLeft: "auto", color: theme.green, fontSize: 22 }}>✓</span>}
      </div>
      <div style={{ color: theme.dim, fontSize: 16, marginTop: 4 }}>{t.title}</div>
      <div
        style={{
          height: 8,
          background: theme.panel2,
          borderRadius: 6,
          overflow: "hidden",
          margin: "12px 0 6px",
        }}
      >
        <div style={{ height: "100%", width: `${pct}%`, background: border }} />
      </div>
      <div style={{ color: theme.fg, fontSize: 18 }}>{pct}%</div>
    </div>
  );
};

interface Msg {
  at: number;
  type: keyof typeof MSG_COLOR;
  from: string;
  to: string;
  body: string;
}
const MSG_COLOR = {
  contract: theme.cyan,
  ask: theme.yellow,
  answer: theme.green,
  done: theme.magenta,
} as const;

const FEED: Msg[] = [
  { at: 26, type: "contract", from: "web", to: "all", body: "API shape agreed" },
  { at: 54, type: "ask", from: "api", to: "orchestrator", body: "need DB schema" },
  { at: 84, type: "answer", from: "orchestrator", to: "api", body: "schema posted" },
  { at: 120, type: "done", from: "docs", to: "all", body: "docs shipped" },
  { at: 156, type: "done", from: "web", to: "all", body: "web done" },
];

export const Board: React.FC<{ len: number }> = ({ len }) => {
  const frame = useCurrentFrame();
  const overall = Math.round(
    THREADS.reduce(
      (sum, t) =>
        sum + interpolate(frame, t.win, [0, 100], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }),
      0,
    ) / THREADS.length,
  );

  return (
    <Fade len={len}>
      <AbsoluteFill style={{ background: theme.bg, fontFamily: theme.mono, padding: 34 }}>
        {/* top bar */}
        <div style={{ display: "flex", alignItems: "center", gap: 18, marginBottom: 22 }}>
          <span style={{ color: theme.fg, fontSize: 24, fontWeight: 700 }}>fleet board</span>
          <div
            style={{
              flex: 1,
              height: 10,
              background: theme.panel2,
              border: `1px solid ${theme.line}`,
              borderRadius: 8,
              overflow: "hidden",
            }}
          >
            <div
              style={{
                height: "100%",
                width: `${overall}%`,
                background: `linear-gradient(90deg, ${theme.accent}, ${theme.cyan})`,
              }}
            />
          </div>
          <span style={{ color: theme.dim, fontSize: 20, width: 64, textAlign: "right" }}>{overall}%</span>
        </div>

        {/* tiles + comms */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 380px", gap: 22, flex: 1 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 18, alignContent: "start" }}>
            {THREADS.map((t) => (
              <Tile key={t.name} t={t} />
            ))}
          </div>
          <div>
            <div
              style={{
                color: theme.dim,
                fontSize: 15,
                textTransform: "uppercase",
                letterSpacing: 1,
                marginBottom: 10,
              }}
            >
              comms
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {FEED.map((m, i) => (
                <Line
                  key={i}
                  at={m.at}
                  style={{
                    background: theme.panel,
                    border: `1px solid ${theme.line}`,
                    borderLeft: `3px solid ${MSG_COLOR[m.type]}`,
                    borderRadius: 8,
                    padding: "8px 11px",
                    fontSize: 17,
                  }}
                >
                  <span style={{ color: MSG_COLOR[m.type] }}>{m.type}</span>{" "}
                  <span style={{ color: theme.fg, fontWeight: 700 }}>
                    {m.from}→{m.to}
                  </span>
                  <div style={{ color: theme.fg }}>{m.body}</div>
                </Line>
              ))}
            </div>
          </div>
        </div>
      </AbsoluteFill>
    </Fade>
  );
};
