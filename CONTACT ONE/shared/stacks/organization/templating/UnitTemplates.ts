import { GameStack } from "../../StackManager";
import { UnitProfiles } from "../UnitProfiles";

export namespace UnitTemplates {
	/**
	 * Used to describe the subordinates of a unit.
	 */
	export type SubordinateArray = [Template, number][];

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
		readonly subordinates: SubordinateArray;
		/**
		 * Describes what stack this template should be placed in on spawn.
		 */
		readonly stack: GameStack;
	}
	
	/**
	 * Flattens a SubordinateArray into a one-dimensional array of templates.
	 */
	export function flattenSubordinates(subordinates: SubordinateArray): Template[] {
		return subordinates.reduce((accumulator, current) => {
			const newTemplates = [];

			for (let i = 0; i < current[1]; i++) {
				newTemplates.push(current[0]);
			}

			return [...accumulator, ...newTemplates];
		}, [] as UnitTemplates.Template[]);
	}
}