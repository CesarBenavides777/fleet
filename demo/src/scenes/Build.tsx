import React from "react";
import { theme } from "../theme";
import { Fade, Line, Prompt, Stage, TerminalCard, Typed } from "../components";

const Diamond: React.FC = () => <span style={{ color: theme.green }}>◆</span>;

// Verbatim from real `fleet swarm plan` + `fleet swarm prepare` runs.
export const Build: React.FC<{ len: number }> = ({ len }) => (
  <Fade len={len}>
    <Stage>
      <TerminalCard fontSize={22}>
        <Prompt>
          <Typed text="fleet swarm plan" start={2} />
        </Prompt>
        <Line at={18}>
          <Diamond /> wrote .fleet/prompts/web.md
        </Line>
        <Line at={24}>
          <Diamond /> wrote .fleet/prompts/api.md
        </Line>
        <Line at={30}>
          <Diamond /> wrote .fleet/prompts/docs.md
        </Line>

        <Prompt>
          <Typed text="fleet swarm prepare" start={46} />
        </Prompt>
        <Line at={66} style={{ color: theme.dim }}>
          swarm prepare — 3 thread(s), base=main
        </Line>
        <Line at={74}>
          <Diamond /> web → swarm/web <span style={{ color: theme.dim }}>@ ../app-worktrees/web</span>
        </Line>
        <Line at={80}>
          <Diamond /> api → swarm/api <span style={{ color: theme.dim }}>@ ../app-worktrees/api</span>
        </Line>
        <Line at={86}>
          <Diamond /> docs → swarm/docs <span style={{ color: theme.dim }}>@ ../app-worktrees/docs</span>
        </Line>
        <Line at={96} style={{ color: theme.cyan }}>
          ◇ board server → http://localhost:8787/board.html
        </Line>
        <Line at={106} style={{ color: theme.dim }}>
          Prepared. <span style={{ color: theme.fg }}>You</span> run{" "}
          <span style={{ color: theme.accent }}>fleet swarm launch</span>
        </Line>
      </TerminalCard>
    </Stage>
  </Fade>
);
