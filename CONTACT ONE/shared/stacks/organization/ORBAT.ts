import { UnitTemplate } from "./templating/Templates";

export interface ORBAT {
	factions: ORBATFaction[]
}

export interface ORBATFaction {
	name: string,
	rootUnits: UnitTemplate[]
}