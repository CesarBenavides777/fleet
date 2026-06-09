import React from "react";
import { theme } from "../theme";
import { Fade, Line, Prompt, Stage, TerminalCard, Typed } from "../components";

// Every line below is verbatim from a real `fleet onboard` run (doctor shows 4
// green checks incl. a live GitHub identity), captured during e2e testing.
const Check: React.FC<{ at: number; target: string; detail: string }> = ({ at, target, detail }) => (
  <Line at={at}>
    <span style={{ color: theme.green }}>✔ ok</span>
    <span style={{ display: "inline-block", width: 250, marginLeft: 20, color: theme.fg, fontWeight: 700 }}>
      {target}
    </span>
    <span style={{ color: theme.dim }}>{detail}</span>
  </Line>
);

export const Onboard: React.FC<{ len: number }> = ({ len }) => (
  <Fade len={len}>
    <Stage>
      <TerminalCard>
        <Prompt>
          <Typed text="fleet onboard" start={2} />
        </Prompt>
        <Line at={20} style={{ color: theme.dim }}>
          ◇ repo: ~/app
        </Line>
        <Line at={30} style={{ color: theme.accent, marginTop: 6 }}>
          ▸ connection doctor
        </Line>
        <Check at={40} target="secrets/dotenv" detail=".env" />
        <Check at={48} target="github/work" detail="CesarBenavides777" />
        <Check at={56} target="mcp/github" detail="https://api.github.com → 200" />
        <Check at={66} target="mcp/local-git" detail="git on PATH" />
        <Line at={78} style={{ color: theme.green, marginTop: 4 }}>
          All 4 checks healthy.
        </Line>
        <Line at={92} style={{ marginTop: 6 }}>
          <span style={{ color: theme.green }}>◆</span> wrote .fleet/swarm.jsonc
        </Line>
      </TerminalCard>
    </Stage>
  </Fade>
);
