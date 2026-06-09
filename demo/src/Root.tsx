import React from "react";
import { Composition } from "remotion";
import { FleetDemo, FLEET_DEMO_DURATION } from "./FleetDemo";

export const Root: React.FC = () => {
  return (
    <Composition
      id="FleetDemo"
      component={FleetDemo}
      durationInFrames={FLEET_DEMO_DURATION}
      fps={30}
      width={1280}
      height={720}
    />
  );
};
