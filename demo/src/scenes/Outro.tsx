import React from "react";
import { AbsoluteFill } from "remotion";
import { theme } from "../theme";
import { Fade, Line, Mark, Typed } from "../components";

export const Outro: React.FC<{ len: number }> = ({ len }) => {
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
        <div style={{ textAlign: "center" }}>
          <div style={{ fontSize: 30, color: theme.fg, marginBottom: 26 }}>
            <span style={{ color: theme.green }}>$ </span>
            <Typed text="fleet swarm launch" start={2} />
          </div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 14 }}>
            <Mark size={52} />
            <Line at={16} style={{ fontSize: 26, color: theme.dim }}>
              github.com/CesarBenavides777/fleet
            </Line>
          </div>
        </div>
      </AbsoluteFill>
    </Fade>
  );
};
