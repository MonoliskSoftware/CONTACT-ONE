/* eslint-disable @typescript-eslint/no-explicit-any */
import Object from "@rbxts/object-utils";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { Unit } from "CONTACT ONE/shared/stacks/organization/elements/Unit";
import { AIBattleController } from "../AIBattleController";
import { WrappedTripMovement } from "../Movements";
import { AreaNode } from "../nodes/Areas";
import { Maneuver } from "./Maneuver";

class AreaAssignmentManager {
	public static assignUnitsToAreas(units: Unit<any, any>[], nodes: AreaNode[]): Map<Unit<any, any>, AreaNode> {
		const assignments = new Map<Unit<any, any>, AreaNode>();

		units.forEach((unit, index) => assignments.set(unit, nodes[index % nodes.size()]));

		return assignments;
	}
}

const CLEAR_AREA_PRIORITY = 51;
const CLEAR_AREA_COVERS_PRIORITY = 52;

/**
 * Clear area maneuvers are used to instruct a unit to check an area for threats and report them.
 */
export class ClearArea extends Maneuver {
	public readonly units = new Map<string, Unit<any, any>>();
	public readonly nodes!: AreaNode[];

	private assignments = new Map<string, AreaNode>();
	private movements = new Map<string, WrappedTripMovement>();

	constructor(units: Unit<any, any>[], nodes: AreaNode[]) {
		super();

		this.units = new Map(units.map(unit => [unit.getId(), unit]));
		this.nodes = nodes;
	}

	public recalculateAssignments(ignoreAlreadyAssigned = false) {
		const [units, nodes] = this.getUnitsAndNodes(ignoreAlreadyAssigned);

		const assignments = AreaAssignmentManager.assignUnitsToAreas(units, nodes);

		assignments.forEach((value, key) => this.assignments.set(key.getId(), value));
	}

	public apply() {
		const characters = Object.values(this.units).map(unit => unit.commander.getValue());
		const characterIds = characters.map(character => character.getId());
		const characterMap = new Map(characters.map(char => [char.getId(), char]));

		// Clean up movements that are no longer part of units
		Object
			.entries(this.movements)
			.filter(([key]) =>
				!characterIds.includes(key))
			.forEach(([, movement]) =>
				movement.dispose());

		// Add movements if they do not exist
		const charactersRequiringMovements = characters
			.filter(char =>
				!this.movements.has(char.getId()))
			.filter(char =>
				char.controller.getValue() instanceof AIBattleController);

		const initializedMovements = charactersRequiringMovements
			.map(char =>
				[char, char.controller.getValue() as AIBattleController] as [Character, AIBattleController])
			.map(([char, controller]) => {
				const assignment = this.assignments.get(char.unit.getValue().getId())!;

				const movement = controller.instantiateMovement(WrappedTripMovement, "ClearAreaManeuverMovement", CLEAR_AREA_PRIORITY, controller.pathfindingAgent, assignment.position.Position);
			
				this.movements.set(char.getId(), movement);

				movement.waitToFinish().then(() => this.onUnitReachedArea(char.unit.getValue()));

				return movement;
			});

		// Update movements
		// TODO: add filtering out for units with non AI battle controllers for existing movements
		Object.entries(this.movements).filter(([, movement]) => !initializedMovements.includes(movement)).forEach(([characterId, movement]) => {
			const assignment = this.assignments.get(characterMap.get(characterId)!.unit.getValue().getId())!;
			
			movement.trip.goal = assignment.position.Position;
			movement.trip.recalculate();
		});
	}

	private onUnitReachedArea(unit: Unit<any, any>) {
		print("Hurray!");
	}

	private getUnitsAndNodes(ignoreAlreadyAssigned = false): [Unit<any, any>[], AreaNode[]] {
		if (ignoreAlreadyAssigned) {
			const assignedUnits = Object.keys(this.assignments);
			const assignedNodes = Object.values(this.assignments);

			return [
				this.getUnitsByIds(Object.keys(this.units).filter(id => !assignedUnits.includes(id))),
				this.nodes.filter(unit => !assignedNodes.includes(unit))
			];
		} else {
			return [Object.values(this.units), this.nodes];
		}
	}

	private getUnitsByIds(ids: string[]): Unit<any, any>[] {
		return ids.map(id => this.units.get(id)!);
	}

	private getUnitById(id: string): Unit<any, any> {
		return this.units.get(id)!;
	}
}