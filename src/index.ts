#!/usr/bin/env bun
import { Command } from "commander";
import { swarmCommand } from "./swarm/index.js";
import { doctorCommand } from "./doctor/index.js";
import { identityCommand } from "./identity/index.js";

const program = new Command();

program
  .name("fleet")
  .description("Portable agent-swarm launcher + connection doctor (works in any git repo)")
  .version("0.1.0");

program.addCommand(swarmCommand);
program.addCommand(doctorCommand);
program.addCommand(identityCommand);

program.parse();
