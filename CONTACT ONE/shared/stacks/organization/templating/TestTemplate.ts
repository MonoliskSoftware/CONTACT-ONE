import { USA } from "./us/US";

function merge<A, B>(a: A, b: B): A & B {
	return {
		...a,
		...b
	};
}

const k = USA.USTemplates.MotorizedInfantrySquad;

export { k as TestTemplate };

