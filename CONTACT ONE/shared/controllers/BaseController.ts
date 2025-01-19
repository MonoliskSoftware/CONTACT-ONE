import { CommandUnit } from "../stacks/organization/elements/CommandUnit";

export interface BaseController {
	commandUnitOnCommandTaken(unit: CommandUnit): void;
	commandUnitOnCommandRemoved(unit: CommandUnit): void;
}