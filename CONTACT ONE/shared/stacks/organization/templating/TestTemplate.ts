import { GameStack } from "../../StackManager";
import { UnitProfiles } from "../UnitProfiles";
import { UnitTemplates } from "./UnitTemplates";

function merge<A, B>(a: A, b: B): A & B {
	return {
		...a,
		...b
	};
}

// const MotorizedInfantryProfile = {
// 	iconId: "rbxassetid://107010730765951",
// 	unitType: "Motorized Infantry"
// } satisfies UnitProfile;

const MotorizedInfantrySquad = {
	stack: GameStack.BATTLE_STACK,
	subordinates: [],
	classProfile: UnitProfiles.USProfiles.MotorizedInfantry,
	sizeProfile: UnitProfiles.USProfiles.Squad,
} satisfies UnitTemplates.Template;

const MotorizedInfantryPlatoon = {
	stack: GameStack.BATTLE_STACK,
	subordinates: [
		[MotorizedInfantrySquad, 3]
	],
	classProfile: UnitProfiles.USProfiles.MotorizedInfantry,
	sizeProfile: UnitProfiles.USProfiles.Platoon,
} satisfies UnitTemplates.Template;

const MotorizedInfantryCompany = {
	stack: GameStack.BATTLE_STACK,
	subordinates: [
		[MotorizedInfantryPlatoon, 3]
	],
	classProfile: UnitProfiles.USProfiles.MotorizedInfantry,
	sizeProfile: UnitProfiles.USProfiles.Company,
} satisfies UnitTemplates.Template;

const MotorizedInfantryBattalion = {
	stack: GameStack.COMMAND_STACK,
	subordinates: [
		[MotorizedInfantryCompany, 3]
	],
	classProfile: UnitProfiles.USProfiles.MotorizedInfantry,
	sizeProfile: UnitProfiles.USProfiles.Battalion,
} satisfies UnitTemplates.Template;

const MotorizedInfantryBrigade = {
	stack: GameStack.COMMAND_STACK,
	subordinates: [
		[MotorizedInfantryBattalion, 3]
	],
	classProfile: UnitProfiles.USProfiles.MotorizedInfantry,
	sizeProfile: UnitProfiles.USProfiles.Brigade,
} satisfies UnitTemplates.Template;

export { MotorizedInfantryBrigade as TestTemplate };

