import { GameStack } from "../../StackManager"

export enum NATOIcons {
	INFANTRY = "rbxassetid://132947461251253",
	INFANTRY_MOTORIZED = "rbxassetid://107010730765951",
	INFANTRY_FIGHTING_VEHICLE = "rbxassetid://126183899121017",
}

export interface UnitTemplate {
	// iconId: string,
	name: string,
	stack: GameStack,
	subordinates: UnitTemplate[]
}