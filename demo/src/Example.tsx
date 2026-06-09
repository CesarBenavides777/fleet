import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

export const Example: React.FC<{ title: string }> = ({ title }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const enter = spring({ frame, fps, config: { damping: 200 } });
  const opacity = interpolate(enter, [0, 1], [0, 1]);
  const y = interpolate(enter, [0, 1], [24, 0]);

  return (
    <AbsoluteFill
      style={{
        background: theme.bg,
        color: theme.fg,
        fontFamily: theme.mono,
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div style={{ opacity, transform: `translateY(${y}px)`, fontSize: 64, fontWeight: 700 }}>
        {title}
      </div>
    </AbsoluteFill>
  );
};
