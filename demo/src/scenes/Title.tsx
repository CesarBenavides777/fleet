import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "../theme";
import { Fade, Mark } from "../components";

export const Title: React.FC<{ len: number }> = ({ len }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const scale = interpolate(enter, [0, 1], [0.9, 1]);
  const y = interpolate(enter, [0, 1], [18, 0]);

  return (
    <Fade len={len}>
      <AbsoluteFill
        style={{
          background: theme.bg,
          color: theme.fg,
          fontFamily: theme.mono,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <div style={{ transform: `translateY(${y}px) scale(${scale})`, textAlign: "center" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 22 }}>
            <Mark size={104} />
            <div
              style={{
                fontSize: 110,
                fontWeight: 800,
                letterSpacing: -2,
                background: `linear-gradient(90deg, ${theme.accent}, ${theme.cyan})`,
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              fleet
            </div>
          </div>
          <div style={{ marginTop: 14, fontSize: 30, color: theme.dim }}>
            parallel agents, one board
          </div>
        </div>
      </AbsoluteFill>
    </Fade>
  );
};
