import { CommandUnit } from "../stacks/organization/CommandUnit";

export interface BaseController {
	commandUnitOnCommandTaken(unit: CommandUnit): void;
	commandUnitOnCommandRemoved(unit: CommandUnit): void;
}