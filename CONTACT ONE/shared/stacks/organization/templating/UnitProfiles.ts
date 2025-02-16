function conjugateNumber(num: number) {
	switch (num % 10) {
		case 1:
			return `${num}st`;
		case 2:
			return `${num}nd`;
		case 3:
			return `${num}rd`;
		default:
			return `${num}th`;
	}
}

/**
 * Utilities and type definitions relating to unit profiles.
 */
export namespace UnitProfiles {
	/**
	 * Conjugates a number/index based on the indexing method provided.
	 * 
	 * @param index Index or number to conjugate.
	 * @param indexingMethod Indexing method to use.
	 */
	export function conjugateIndex(index: number, indexingMethod: SizeIndexing): string {
		if (indexingMethod === SizeIndexing.NUMERALS) {
			return conjugateNumber(index);
		} else {
			return NATO_Alphabet[index % 26];
		}
	}

	/**
	 * Generates a name for a unit based on the size and class provided.
	 * 
	 * @param unitSize Size profile of the new unit.
	 * @param unitClass Class of the new unit.
	 * @param index Index of the new unit relative to its colleagues.
	 */
	export function generateName(unitSize: SizeProfile, unitClass: ClassProfile, index = 1): string {
		return `${conjugateIndex(index, unitSize.indexingMethod)} ${unitClass.name} ${unitSize.name}`;
	}

	/**
	 * Reference icons, used for unit class profiles.
	 */
	export enum NATOIcons {
		INFANTRY = "rbxassetid://132947461251253",
		INFANTRY_MOTORIZED = "rbxassetid://107010730765951",
		INFANTRY_FIGHTING_VEHICLE = "rbxassetid://126183899121017",
	}

	/**
	 * 
	 */
	export const NATO_Alphabet = [
		"Alpha",
		"Bravo",
		"Charlie",
		"Delta",
		"Echo",
		"Foxtrot",
		"Golf",
		"Hotel",
		"India",
		"Juliet",
		"Kilo",
		"Lima",
		"Mike",
		"November",
		"Oscar",
		"Papa",
		"Quebec",
		"Romero",
		"Sierra",
		"Tango",
		"Uniform",
		"Victor",
		"Winter",
		"X-ray",
		"Yankee",
		"Zulu"
	];

	/**
	  * Describes a general profile for a unit type, such as Infantry or Armor.
	  */
	export interface ClassProfile {
		/**
		 * ID of the NATO symbol used for this unit.
		 */
		readonly iconId: string;
		/**
		 * String representing this profile type, such as 'Infantry' or 'Armor'.
		 */
		readonly name: string;
		/**
		 * Acronym used to identify this class, such as 'I' or 'A'.
		 */
		readonly acronym: string;
		/**
		 * Description describing the unit and its purpose.
		 */
		readonly description: string;
	}

	/**
	 * Indexing method used
	 */
	export enum SizeIndexing {
		/**
		 * Subordinates will be indexed by 'Alpha', 'Bravo', 'Charlie'... etc.
		 */
		NATO_ALPHABET,
		/**
		 * Subordinates will be index by number, such as '1', '2', '3'... etc.
		 */
		NUMERALS,
	}

	/**
	 * Describes a general profile for a unit size, such as a Battalion or a Division.
	 */
	export interface SizeProfile {
		/**
		 * How instances of the unit will be indexed.
		 */
		readonly indexingMethod: SizeIndexing;
		/**
		 * Name of the Unit size, such as "Battalion" or "Division"
		 */
		readonly name: string;
		/**
		 * Identifier used to index this unit. Usually just the first letter of the name, such as "B" or "D".
		 */
		readonly acronym: string;
		/**
		 * Description describing the unit and its purpose.
		 */
		readonly description: string;
	}
}