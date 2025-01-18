import { UnitTemplates } from "./organization/templating/UnitTemplates";

export namespace Scenarios {
	/**
	 * Describes a faction for instantiation.
	 */
	export interface FactionDescription {
		/**
		 * Faction name
		 */
		readonly name: string;
		/**
		 * Root units
		 */
		readonly rootUnits: UnitTemplates.Template[];
	}

	/**
	 * An ORBAT (or an ORder of BATtle) describes a scenario, its factions, and their units.
	 */
	export interface ORBAT {
		readonly factions: FactionDescription[];
	}
}