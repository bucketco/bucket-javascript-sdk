import { Command } from "commander";

export function commandName(command: Command) {
  if (command.parent) {
    const parentName = command.parent.name();
    if (parentName && parentName !== "index") {
      return `${parentName} ${command.name()}`;
    }
  }
  return command.name();
}
