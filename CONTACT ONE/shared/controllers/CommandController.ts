import { CommandUnit } from "../stacks/organization/elements/CommandUnit";

export interface CommandController {
	commandUnitOnCommandTaken(unit: CommandUnit): void;
	commandUnitOnCommandRemoved(unit: CommandUnit): void;
}