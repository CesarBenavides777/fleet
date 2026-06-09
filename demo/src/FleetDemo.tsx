import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { theme } from "./theme";
import { Title } from "./scenes/Title";
import { Terminal } from "./scenes/Terminal";
import { Board } from "./scenes/Board";
import { Outro } from "./scenes/Outro";

// 450 frames @ 30fps = 15s. Scenes overlap slightly so the Fade wrappers cross-fade.
export const FLEET_DEMO_DURATION = 450;

export const FleetDemo: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg }}>
    <Sequence from={0} durationInFrames={78}>
      <Title len={78} />
    </Sequence>
    <Sequence from={72} durationInFrames={148}>
      <Terminal len={148} />
    </Sequence>
    <Sequence from={214} durationInFrames={202}>
      <Board len={202} />
    </Sequence>
    <Sequence from={412} durationInFrames={38}>
      <Outro len={38} />
    </Sequence>
  </AbsoluteFill>
);
