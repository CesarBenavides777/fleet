import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import { theme } from "./theme";
import { Title } from "./scenes/Title";
import { Onboard } from "./scenes/Onboard";
import { Build } from "./scenes/Build";
import { Board } from "./scenes/Board";
import { Launch } from "./scenes/Launch";
import { Outro } from "./scenes/Outro";

// ~30s @ 30fps. Scenes overlap a few frames so the Fade wrappers cross-fade.
// Every terminal line is verbatim from a real e2e run (onboard/plan/prepare/launch).
export const FLEET_DEMO_DURATION = 912;

export const FleetDemo: React.FC = () => (
  <AbsoluteFill style={{ background: theme.bg }}>
    <Sequence from={0} durationInFrames={78}>
      <Title len={78} />
    </Sequence>
    <Sequence from={72} durationInFrames={224}>
      <Onboard len={224} />
    </Sequence>
    <Sequence from={290} durationInFrames={240}>
      <Build len={240} />
    </Sequence>
    <Sequence from={524} durationInFrames={206}>
      <Board len={206} />
    </Sequence>
    <Sequence from={724} durationInFrames={150}>
      <Launch len={150} />
    </Sequence>
    <Sequence from={868} durationInFrames={44}>
      <Outro len={44} />
    </Sequence>
  </AbsoluteFill>
);
