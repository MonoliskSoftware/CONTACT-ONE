import { GameStack } from "../../StackManager";
import { UnitTemplate } from "./Templates";

function merge<A, B>(a: A, b: B): A & B {
	return {
		...a,
		...b
	};
}

const MotorizedInfantrySquad = {
	subordinates: [],
	stack: GameStack.BATTLE_STACK
};

const MotorizedInfantryPlatoon = {
	name: "Motorized Infantry Platoon",
	stack: GameStack.BATTLE_STACK,
	subordinates: [
		merge(MotorizedInfantrySquad, {
			name: "Alpha Squad"
		}),
		merge(MotorizedInfantrySquad, {
			name: "Bravo Squad"
		}),
		merge(MotorizedInfantrySquad, {
			name: "Charlie Squad"
		})
	]
} satisfies UnitTemplate;

const MotorizedInfantryCompany = {
	name: "Motorized Infantry Company",
	stack: GameStack.BATTLE_STACK,
	subordinates: [
		merge(MotorizedInfantryPlatoon, {
			name: "1st Platoon"
		}),
		merge(MotorizedInfantryPlatoon, {
			name: "2nd Platoon"
		}),
		merge(MotorizedInfantryPlatoon, {
			name: "3rd Platoon"
		})
	]
} satisfies UnitTemplate;

const MotorizedInfantryBattalion = {
	name: "Motorized Infantry Battalion",
	stack: GameStack.BATTLE_STACK,
	subordinates: [
		merge(MotorizedInfantryCompany, {
			name: "Alpha Company"
		}),
		merge(MotorizedInfantryCompany, {
			name: "Echo Company"
		}),
		merge(MotorizedInfantryCompany, {
			name: "Charlie Company"
		}),
	]
} satisfies UnitTemplate;

export const TestTemplate = {
	name: "test",
	stack: GameStack.COMMAND_STACK,
	subordinates: [
		MotorizedInfantryBattalion
	]
} satisfies UnitTemplate;