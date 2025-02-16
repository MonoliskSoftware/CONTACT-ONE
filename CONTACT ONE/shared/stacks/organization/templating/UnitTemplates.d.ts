import { NestedArray } from "CONTACT ONE/shared/util/NestedArray";
import { GameStack } from "../../StackManager";
import { Loadouts } from "./UnitLoadouts";
import { UnitProfiles } from "./UnitProfiles";

export namespace UnitTemplates {
	/**
	 * Describes a template for a unit.
	 */
	export interface Template {
		/**
		 * Overrides auto generated name with whatever is provided.
		 */
		readonly nameOverride?: string;
		/**
		 * Describes the class of the unit.
		 */
		readonly classProfile: UnitProfiles.ClassProfile;
		/**
		 * Describes the size of the unit.
		 */
		readonly sizeProfile: UnitProfiles.SizeProfile;
		/**
		 * Describes the type of template to be used when creating new subordinate units at runtime.
		 */
		readonly defaultSubordinateTemplate?: Template;
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
		readonly subordinates: NestedArray<Template>;
		/**
		 * Describes what stack this template should be placed in on spawn.
		 */
		readonly stack: GameStack;
		/**
		 * Describes the member characters of this unit.
		 * 
		 * The first unit will become the commander.
		 */
		readonly members: NestedArray<Loadouts.CharacterLoadout>;
	}
}