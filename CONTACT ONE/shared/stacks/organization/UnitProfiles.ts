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

	export namespace USProfiles {
		// Classes
		// Frontline units
		export const MotorizedInfantry: ClassProfile = {
			iconId: "rbxassetid://107010730765951",
			name: "Motorized Infantry",
			description: "Motorized Infantry utilizes light armored vehicles and transport trucks. Combining the strength of infantry with the speed of mobile transports, Motorized Infantry can quickly deploy and adapt to varius conditions and situations.",
			acronym: "MI"
		};

		export const LightInfantry: ClassProfile = {
			iconId: "",
			name: "Light Infantry",
			description: "Light Infantry units are agile and flexible, equipped for rapid deployments and quick maneuvering. Light Infantry is mainly focused on reconaissance and light combat, often working in conjunction with other units.",
			acronym: "I"
		};

		export const Armor: ClassProfile = {
			iconId: "",
			name: "Armor",
			description: "Armor units use heavily armored vehicles designed for frontline combat, purposed for strong firepower and heavy durability. Armor units excel in direct engagements, offering protection and suppression capabilities in tough conditions.\nBest for spearheading attacks and running breakthroughs, they are strong yet slow, and are very vulnerable to supply line attacks.",
			acronym: "A"
		};

		export const MechanizedInfantry: ClassProfile = {
			iconId: "",
			name: "Mechanized Infantry",
			description: "Mechanized Infantry units, also known as Combined Arms units, combine the heavy firepower of armored vehicles with the rapid deployment and adaptability of traditional infantry. They excel in coordinated assaults, using vehicle-mounted units to rapidly maneuver across diverse terrains, providing sustained combat effectiveness in both offensive and defensive operations. Vulnerable to heavy anti-armor tactics and supply disruptions, they require support from logistics and specialized protection units.",
			acronym: "CA"
		};

		// Support units
		export const Sustainment: ClassProfile = {
			iconId: "",
			name: "Sustainment Support",
			description: "Sustainment units are responsible for providing logistical and maintenance support to combat forces, securing supply lines and sustaining unit operability in prolonged engagements. While Sustainment units rarely see the frontlines themselves, they are incredibly important for multi-day (or even multi-hour) campaigns.",
			acronym: "SU"
		};

		export const FieldArtillery: ClassProfile = {
			iconId: "",
			name: "Field Artillery",
			description: "Field Artillery units deliver heavy, indirect firepower to soften enemy defenses and support other units during joint assaults. They excel in providing ranged, high-damage support to ground and air units, focusing on precision and saturation fire. They are often vulnerable to direct, close-range combat, and as such, need protection from other units.",
			acronym: "FA"
		};

		export const Engineer: ClassProfile = {
			iconId: "",
			name: "Combat Engineer",
			description: "Combat Engineer units are skilled specialists in construction, fortification, and demolition. They play a critical role in creating and maintaining battlefield infrastructure, ensuring mobility, and disabling enemy defenses.",
			acronym: "CE"
		};

		// Sizes
		export const Brigade: SizeProfile = {
			indexingMethod: SizeIndexing.NUMERALS,
			acronym: "BCT",
			name: "Brigade",
			description: "Brigades are large, versatile formations composed of multiple battalions, capable of independent operations."
		};

		export const Battalion: SizeProfile = {
			indexingMethod: SizeIndexing.NUMERALS,
			acronym: "B",
			name: "Battalion",
			description: "Battalions are specialized, mid-sized units consisting of several companies, designed for coordinated engagements."
		};

		export const Company: SizeProfile = {
			indexingMethod: SizeIndexing.NATO_ALPHABET,
			acronym: "C",
			name: "Company",
			description: "A Company is a structured group of multiple platoons, specializing in focused battlefield roles."
		};

		export const Platoon: SizeProfile = {
			indexingMethod: SizeIndexing.NUMERALS,
			acronym: "P",
			name: "Platoon",
			description: "Platoons are small, maneuverable units formed by several squads."
		};

		export const Squad: SizeProfile = {
			indexingMethod: SizeIndexing.NUMERALS,
			acronym: "S",
			name: "Squad",
			description: "Squads are compact teams of soldiers."
		};
	}
}