import { Command } from "commander";

export function commandName(command: Command) {
  if (
    command.parent &&
    command.parent.name() &&
    command.parent.name() !== "index"
  ) {
    return `${command.parent.name()} ${command.name()}`;
  }
  return command.name();
}
