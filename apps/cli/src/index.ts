#!/usr/bin/env bun
import { Command } from "commander";
import { swarmCommand } from "@fleet/swarm";
import { busCommand } from "@fleet/bus";
import { doctorCommand } from "@fleet/doctor";
import { identityCommand } from "@fleet/identity";
import { onboardCommand } from "./onboard/index.js";

const program = new Command();

program
  .name("fleet")
  .description(
    "Agent-swarm launcher + connection doctor: parallel agents over git worktrees + cmux/tmux surfaces (works in any git repo)",
  )
  .version("0.1.0");

program.addCommand(onboardCommand);
program.addCommand(swarmCommand);
program.addCommand(busCommand);
program.addCommand(doctorCommand);
program.addCommand(identityCommand);

program.parse();
