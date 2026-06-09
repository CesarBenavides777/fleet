import React from "react";
import { AbsoluteFill } from "remotion";
import { theme } from "../theme";
import { Fade, Line, Typed } from "../components";

const Dot: React.FC<{ c: string }> = ({ c }) => (
  <span style={{ width: 12, height: 12, borderRadius: 12, background: c, display: "inline-block" }} />
);

const Prompt: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ marginTop: 6 }}>
    <span style={{ color: theme.green }}>$ </span>
    {children}
  </div>
);

export const Terminal: React.FC<{ len: number }> = ({ len }) => {
  return (
    <Fade len={len}>
      <AbsoluteFill
        style={{
          background: theme.bg,
          fontFamily: theme.mono,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            width: 980,
            background: theme.panel,
            border: `1px solid ${theme.line}`,
            borderRadius: 14,
            boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 16px",
              borderBottom: `1px solid ${theme.line}`,
            }}
          >
            <Dot c={theme.red} />
            <Dot c={theme.yellow} />
            <Dot c={theme.green} />
            <span style={{ color: theme.dim, marginLeft: 10, fontSize: 18 }}>fleet — zsh</span>
          </div>
          <div style={{ padding: "22px 26px", fontSize: 26, lineHeight: 1.5, color: theme.fg }}>
            <Prompt>
              <Typed text="fleet onboard" start={2} />
            </Prompt>
            <Line at={22} style={{ color: theme.green }}>
              ✓ connections healthy · 4/4 identities
            </Line>

            <Prompt>
              <Typed text="fleet swarm prepare" start={36} />
            </Prompt>
            <Line at={58} style={{ color: theme.fg }}>
              <span style={{ color: theme.green }}>◆</span> alpha → swarm/alpha
            </Line>
            <Line at={66} style={{ color: theme.fg }}>
              <span style={{ color: theme.green }}>◆</span> beta&nbsp;&nbsp;→ swarm/beta
            </Line>
            <Line at={74} style={{ color: theme.cyan }}>
              ◇ board server → http://localhost:8787/board.html
            </Line>
            <Line at={86} style={{ color: theme.dim }}>
              Prepared. <span style={{ color: theme.fg }}>You</span> run{" "}
              <span style={{ color: theme.accent }}>fleet swarm launch</span>
            </Line>
          </div>
        </div>
      </AbsoluteFill>
    </Fade>
  );
};
