import { GameStack } from "../../StackManager";
import { UnitProfiles } from "../UnitProfiles";
import { Loadouts } from "./Loadouts";
import { UnitTemplates } from "./UnitTemplates";

function merge<A, B>(a: A, b: B): A & B {
	return {
		...a,
		...b
	};
}

const RiflemanLoadout = {
	tools: [
		"CONTACT ONE/assets/prefabs/ClassicSword"
	]
} satisfies Loadouts.CharacterLoadout;

const MotorizedInfantrySquad = {
	stack: GameStack.BATTLE_STACK,
	subordinates: [],
	classProfile: UnitProfiles.USProfiles.MotorizedInfantry,
	sizeProfile: UnitProfiles.USProfiles.Squad,
	members: [[RiflemanLoadout, 1]]
} satisfies UnitTemplates.Template;

const MotorizedInfantryPlatoon = {
	stack: GameStack.BATTLE_STACK,
	subordinates: [
		[MotorizedInfantrySquad, 3]
	],
	classProfile: UnitProfiles.USProfiles.MotorizedInfantry,
	sizeProfile: UnitProfiles.USProfiles.Platoon,
	members: [[RiflemanLoadout, 1]]
} satisfies UnitTemplates.Template;

const MotorizedInfantryCompany = {
	stack: GameStack.COMMAND_STACK,
	subordinates: [
		[MotorizedInfantryPlatoon, 3]
	],
	classProfile: UnitProfiles.USProfiles.MotorizedInfantry,
	sizeProfile: UnitProfiles.USProfiles.Company,
	members: [[RiflemanLoadout, 1]]
} satisfies UnitTemplates.Template;

const MotorizedInfantryBattalion = {
	stack: GameStack.COMMAND_STACK,
	subordinates: [
		[MotorizedInfantryCompany, 3]
	],
	classProfile: UnitProfiles.USProfiles.MotorizedInfantry,
	sizeProfile: UnitProfiles.USProfiles.Battalion,
	members: [[RiflemanLoadout, 1]]
} satisfies UnitTemplates.Template;

const MotorizedInfantryBrigade = {
	stack: GameStack.COMMAND_STACK,
	subordinates: [
		[MotorizedInfantryBattalion, 3]
	],
	classProfile: UnitProfiles.USProfiles.MotorizedInfantry,
	sizeProfile: UnitProfiles.USProfiles.Brigade,
	members: [[RiflemanLoadout, 1]]
} satisfies UnitTemplates.Template;

export { MotorizedInfantryCompany as TestTemplate };

