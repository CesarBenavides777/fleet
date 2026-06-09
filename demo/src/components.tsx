import React from "react";
import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { theme } from "./theme";

/** A hexagon "bee" mark with a gradient stroke — emoji-free for headless render. */
export const Mark: React.FC<{ size?: number }> = ({ size = 96 }) => (
  <svg width={size} height={size} viewBox="0 0 100 100">
    <defs>
      <linearGradient id="markg" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor={theme.accent} />
        <stop offset="1" stopColor={theme.cyan} />
      </linearGradient>
    </defs>
    <polygon
      points="50,6 88,28 88,72 50,94 12,72 12,28"
      fill="none"
      stroke="url(#markg)"
      strokeWidth={6}
      strokeLinejoin="round"
    />
    <circle cx={50} cy={50} r={11} fill="url(#markg)" />
    <circle cx={36} cy={42} r={4} fill={theme.fg} />
    <circle cx={64} cy={42} r={4} fill={theme.fg} />
  </svg>
);

/** Reveal text by frame like it's being typed, with a blinking cursor. */
export const Typed: React.FC<{ text: string; start: number; cps?: number; color?: string }> = ({
  text,
  start,
  cps = 42,
  color,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  if (frame < start) return null;
  const elapsed = frame - start;
  const n = Math.min(text.length, Math.floor((elapsed / fps) * cps));
  const done = n >= text.length;
  const blink = Math.floor(frame / 8) % 2 === 0;
  return (
    <span style={{ color }}>
      {text.slice(0, n)}
      <span style={{ opacity: done ? 0 : 1, color: theme.cyan }}>{blink ? "▋" : " "}</span>
    </span>
  );
};

/** Fade a block in at frame `at`. */
export const Line: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  at,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [at, at + 6], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <div style={{ opacity, ...style }}>{children}</div>;
};

/** Scene wrapper: cross-fade in at the start and out near `len`. */
export const Fade: React.FC<{ len: number; children: React.ReactNode; style?: React.CSSProperties }> = ({
  len,
  children,
  style,
}) => {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, len - 10, len], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  return <div style={{ opacity, width: "100%", height: "100%", ...style }}>{children}</div>;
};
