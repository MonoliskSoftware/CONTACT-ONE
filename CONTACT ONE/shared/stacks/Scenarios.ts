import { NestedArray } from "../util/NestedArray";
import { UnitTemplates } from "./organization/templating/UnitTemplates";

export namespace Scenarios {
	export type UnitDescription = UnitTemplates.Template & {
		/**
		 * Used to describe the subordinates of a unit.
		 * 
		 * Example:
		 * For a subordinate array of:
		 * ```ts 
		 * const subordinates = [[InfantrySquad, 4], [ArmorSquad, 2]];
		 * ```
		 * 4 infantry squads then 2 armor squads will be added as subordinates. 
		 */
		readonly subordinates: NestedArray<UnitDescription>;
	}

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
		readonly rootUnits: UnitDescription[];
	}

	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	export type WinCondition = {
		winFaction: string,
		type: string,
	} | {
		stalemate: true,
		type: string,
	};

	export type FactionEliminationCondition = {
		losingFaction: string,
		type: "FactionElimination"
	} & WinCondition;

	/**
	 * An ORBAT (or an ORder of BATtle) describes a scenario, its factions, and their units.
	 */
	export interface ORBAT {
		readonly factions: FactionDescription[];
		readonly winConditions: WinCondition[]
	}
}