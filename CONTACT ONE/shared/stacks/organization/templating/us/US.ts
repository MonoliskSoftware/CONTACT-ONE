import { GameStack } from "CONTACT ONE/shared/stacks/StackManager";
import { Loadouts } from "../UnitLoadouts";
import { UnitProfiles } from "../UnitProfiles";
import { UnitTemplates } from "../UnitTemplates";

export namespace USA {
	export namespace USClasses {
		// Classes
		// Frontline units
		export const MotorizedInfantry: UnitProfiles.ClassProfile = {
			iconId: "rbxassetid://107010730765951",
			name: "Motorized Infantry",
			description: "Motorized Infantry utilizes light armored vehicles and transport trucks. Combining the strength of infantry with the speed of mobile transports, Motorized Infantry can quickly deploy and adapt to varius conditions and situations.",
			acronym: "MI"
		};

		export const LightInfantry: UnitProfiles.ClassProfile = {
			iconId: "",
			name: "Light Infantry",
			description: "Light Infantry units are agile and flexible, equipped for rapid deployments and quick maneuvering. Light Infantry is mainly focused on reconaissance and light combat, often working in conjunction with other units.",
			acronym: "I"
		};

		export const Armor: UnitProfiles.ClassProfile = {
			iconId: "",
			name: "Armor",
			description: "Armor units use heavily armored vehicles designed for frontline combat, purposed for strong firepower and heavy durability. Armor units excel in direct engagements, offering protection and suppression capabilities in tough conditions.\nBest for spearheading attacks and running breakthroughs, they are strong yet slow, and are very vulnerable to supply line attacks.",
			acronym: "A"
		};

		export const MechanizedInfantry: UnitProfiles.ClassProfile = {
			iconId: "",
			name: "Mechanized Infantry",
			description: "Mechanized Infantry units, also known as Combined Arms units, combine the heavy firepower of armored vehicles with the rapid deployment and adaptability of traditional infantry. They excel in coordinated assaults, using vehicle-mounted units to rapidly maneuver across diverse terrains, providing sustained combat effectiveness in both offensive and defensive operations. Vulnerable to heavy anti-armor tactics and supply disruptions, they require support from logistics and specialized protection units.",
			acronym: "CA"
		};

		// Support units
		export const Sustainment: UnitProfiles.ClassProfile = {
			iconId: "",
			name: "Sustainment Support",
			description: "Sustainment units are responsible for providing logistical and maintenance support to combat forces, securing supply lines and sustaining unit operability in prolonged engagements. While Sustainment units rarely see the frontlines themselves, they are incredibly important for multi-day (or even multi-hour) campaigns.",
			acronym: "SU"
		};

		export const FieldArtillery: UnitProfiles.ClassProfile = {
			iconId: "",
			name: "Field Artillery",
			description: "Field Artillery units deliver heavy, indirect firepower to soften enemy defenses and support other units during joint assaults. They excel in providing ranged, high-damage support to ground and air units, focusing on precision and saturation fire. They are often vulnerable to direct, close-range combat, and as such, need protection from other units.",
			acronym: "FA"
		};

		export const Engineer: UnitProfiles.ClassProfile = {
			iconId: "",
			name: "Combat Engineer",
			description: "Combat Engineer units are skilled specialists in construction, fortification, and demolition. They play a critical role in creating and maintaining battlefield infrastructure, ensuring mobility, and disabling enemy defenses.",
			acronym: "CE"
		};

		export namespace Experimental {
			// Air Forces - Fixed Wing
			export const TacticalAir: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Tactical Air",
				description: "Tactical air units provide close air support, air interdiction, and tactical airlift capabilities. They excel at supporting ground forces with precision strikes and rapid response capabilities.",
				acronym: "TAC"
			};
	
			export const AirSuperiority: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Air Superiority",
				description: "Air Superiority fighters focus on achieving and maintaining air dominance through air-to-air combat. Essential for protecting other air assets and denying enemy air capabilities.",
				acronym: "AS"
			};
	
			// Air Forces - Rotary Wing
			export const AttackAviation: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Attack Aviation",
				description: "Attack helicopter units provide close air support, anti-armor capabilities, and armed reconnaissance. Highly effective at supporting ground forces in close combat situations.",
				acronym: "AA"
			};
	
			export const AirAssault: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Air Assault",
				description: "Air Assault units combine transport helicopters with infantry for rapid deployment and vertical envelopment capabilities. Excellent for quick insertions and securing strategic positions.",
				acronym: "AASLT"
			};
	
			// Naval Forces
			export const NavalSurface: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Surface Warfare",
				description: "Surface warfare vessels provide naval gunfire support, anti-ship capabilities, and coastal operations support. Essential for controlling sea lanes and supporting littoral operations.",
				acronym: "SW"
			};
	
			export const Submarine: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Submarine Forces",
				description: "Submarine units provide stealth reconnaissance, anti-ship capabilities, and strategic deterrence. Critical for controlling sea lanes and conducting covert operations.",
				acronym: "SUB"
			};
	
			export const MarineInfantry: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Marine Infantry",
				description: "Marine infantry units specialize in amphibious operations and coastal warfare. Capable of ship-to-shore operations and securing beachheads for larger forces.",
				acronym: "MAR"
			};
	
			// Support/Specialized Units
			export const AirDefense: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Air Defense Artillery",
				description: "Air Defense units protect ground forces and installations from aerial threats using a mix of radar systems and surface-to-air weapons.",
				acronym: "ADA"
			};
	
			export const SignalsIntel: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Signals Intelligence",
				description: "SIGINT units provide electronic warfare capabilities, communications intelligence, and cyber operations support. Critical for modern battlefield information dominance.",
				acronym: "SIG"
			};
	
			export const SpecialForces: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Special Forces",
				description: "Elite units trained for unconventional warfare, special reconnaissance, and direct action missions. Operates independently or in support of conventional forces.",
				acronym: "SF"
			};
	
			export const ReconnaissanceUnit: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Reconnaissance",
				description: "Specialized units focused on battlefield intelligence gathering, target acquisition, and surveillance. Essential for providing tactical intelligence to command elements.",
				acronym: "REC"
			};
	
			// Combat Support
			export const MedicalSupport: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Medical Support",
				description: "Medical units provide battlefield trauma care, evacuation services, and field hospital capabilities. Critical for maintaining combat effectiveness through casualty care.",
				acronym: "MED"
			};
	
			export const ChemicalDefense: UnitProfiles.ClassProfile = {
				iconId: "",
				name: "Chemical Defense",
				description: "CBRN defense units handle detection, protection, and decontamination from chemical, biological, radiological, and nuclear threats.",
				acronym: "CBRN"
			};
		}
	}

	export namespace USSizes {
		export const Brigade: UnitProfiles.SizeProfile = {
			indexingMethod: UnitProfiles.SizeIndexing.NUMERALS,
			acronym: "BCT",
			name: "Brigade",
			description: "Brigades are large, versatile formations composed of multiple battalions, capable of independent operations."
		};
	
		export const Battalion: UnitProfiles.SizeProfile = {
			indexingMethod: UnitProfiles.SizeIndexing.NUMERALS,
			acronym: "B",
			name: "Battalion",
			description: "Battalions are specialized, mid-sized units consisting of several companies, designed for coordinated engagements."
		};
	
		export const Company: UnitProfiles.SizeProfile = {
			indexingMethod: UnitProfiles.SizeIndexing.NATO_ALPHABET,
			acronym: "C",
			name: "Company",
			description: "A Company is a structured group of multiple platoons, specializing in focused battlefield roles."
		};
	
		export const Platoon: UnitProfiles.SizeProfile = {
			indexingMethod: UnitProfiles.SizeIndexing.NUMERALS,
			acronym: "P",
			name: "Platoon",
			description: "Platoons are small, maneuverable units formed by several squads."
		};
	
		export const Squad: UnitProfiles.SizeProfile = {
			indexingMethod: UnitProfiles.SizeIndexing.NUMERALS,
			acronym: "S",
			name: "Squad",
			description: "Squads are compact teams of soldiers."
		};
	}

	export namespace USLoadouts {
		export const Rifleman = {
			name: "Rifleman",
			tools: [
				"CONTACT ONE/assets/prefabs/ClassicSword"
			]
		} satisfies Loadouts.CharacterLoadout;
	}

	export namespace USTemplates {
		export const MotorizedInfantrySquad = {
			stack: GameStack.COMMAND_STACK,
			subordinates: [],
			classProfile: USClasses.MotorizedInfantry,
			sizeProfile: USSizes.Squad,
			members: [
				[USLoadouts.Rifleman, 1], // Squad lead
				[USLoadouts.Rifleman, 3], // First team
				[USLoadouts.Rifleman, 3], // Second team
			]
		} satisfies UnitTemplates.Template;
		
		export const MotorizedInfantryPlatoon = {
			stack: GameStack.COMMAND_STACK,
			subordinates: [
				[MotorizedInfantrySquad, 3]
			],
			classProfile: USClasses.MotorizedInfantry,
			sizeProfile: USSizes.Platoon,
			members: [[USLoadouts.Rifleman, 4]]
		} satisfies UnitTemplates.Template;
		
		export const MotorizedInfantryCompany = {
			stack: GameStack.COMMAND_STACK,
			subordinates: [
				[MotorizedInfantryPlatoon, 3]
			],
			classProfile: USClasses.MotorizedInfantry,
			sizeProfile: USSizes.Company,
			members: [[USLoadouts.Rifleman, 6]]
		} satisfies UnitTemplates.Template;
		
		export const MotorizedInfantryBattalion = {
			stack: GameStack.COMMAND_STACK,
			subordinates: [
				[MotorizedInfantryCompany, 3]
			],
			classProfile: USClasses.MotorizedInfantry,
			sizeProfile: USSizes.Battalion,
			members: [[USLoadouts.Rifleman, 4]]
		} satisfies UnitTemplates.Template;
		
		export const MotorizedInfantryBrigade = {
			stack: GameStack.COMMAND_STACK,
			subordinates: [
				[MotorizedInfantryBattalion, 3]
			],
			classProfile: USClasses.MotorizedInfantry,
			sizeProfile: USSizes.Brigade,
			members: [[USLoadouts.Rifleman, 1]]
		} satisfies UnitTemplates.Template;
	}
}