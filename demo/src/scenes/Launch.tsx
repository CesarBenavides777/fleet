import React from "react";
import { theme } from "../theme";
import { Fade, Line, Prompt, Stage, TerminalCard, Typed } from "../components";

const Diamond: React.FC = () => <span style={{ color: theme.green }}>◆</span>;

// Verbatim shape of a real `fleet swarm launch` run (cmux surface refs).
export const Launch: React.FC<{ len: number }> = ({ len }) => (
  <Fade len={len}>
    <Stage>
      <TerminalCard>
        <Prompt>
          <Typed text="fleet swarm launch" start={2} />
        </Prompt>
        <Line at={22} style={{ color: theme.dim }}>
          swarm launch — 3 agent(s) via cmux
        </Line>
        <Line at={30}>
          <Diamond /> web → <span style={{ color: theme.cyan }}>surface:62</span>
        </Line>
        <Line at={36}>
          <Diamond /> api → <span style={{ color: theme.cyan }}>surface:63</span>
        </Line>
        <Line at={42}>
          <Diamond /> docs → <span style={{ color: theme.cyan }}>surface:64</span>
        </Line>
        <Line at={54} style={{ color: theme.dim, marginTop: 4 }}>
          Launched. Board: <span style={{ color: theme.cyan }}>http://localhost:8787/board.html</span>
        </Line>
      </TerminalCard>
    </Stage>
  </Fade>
);
