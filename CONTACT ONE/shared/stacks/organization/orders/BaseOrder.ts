/* eslint-disable @typescript-eslint/no-explicit-any */
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { SpawnManager } from "CORP/shared/Scripts/Networking/SpawnManager";
import { CommandUnit } from "../elements/CommandUnit";
import { Unit } from "../elements/Unit";

type OptionalKeys<T> = {
	[K in keyof T]: object extends Pick<T, K> ? K : never;
}[keyof T];

type OptionalProperties<T> = Pick<T, OptionalKeys<T>>;

/**
 * Describes a configuration for a unit.
 */
export interface OrderConfiguration {
	/**
	 * The maximum number of units this order can be assigned to. -1 for infinite.
	 */
	readonly maxUnits?: number;
	/**
	 * Name of the order type.
	 */
	readonly name: string;
}

export const DefaultConfiguration: Required<OptionalProperties<OrderConfiguration>> = {
	maxUnits: -1
};

/**
 * Orders are used to define instructions for units. Order cans be given by players and by AI.
 */
export abstract class BaseOrder<U extends Unit<any, any>, T> extends NetworkBehavior {
	public readonly assignedUnitIds = new NetworkVariable(this, undefined as unknown as string[]);
	public readonly originUnit = new NetworkVariable(this, undefined as unknown as CommandUnit);

	public readonly abstract config: OrderConfiguration;

	/**
	 * The execution config is a set of parameters that are modifiable by whoever filed the order.
	 * 
	 * The type for the execution config is changeable through the generic argument T.
	 */
	public readonly abstract executionConfig: T; 

	constructor(gameObject: GameObject) {
		super(gameObject);
	}

	/**
	 * @returns An array of units assigned to this order.
	 */
	public getAssignedUnits(): U[] {
		return this.assignedUnitIds.getValue().map(id => SpawnManager.getNetworkBehaviorById(id) as U);
	}

	/**
	 * Assigns the supplied unit to this order.
	 * 
	 * @returns True if the unit was not assigned to this order and now is, else false.
	 */
	public assignUnit(unit: U): boolean {
		if (this.isUnitAssigned(unit)) return false;

		this.assignedUnitIds.setValue([...this.assignedUnitIds.getValue(), unit.getId()]);

		return true;
	}

	/**
	 * Sets assigned units to the array provided.
	 */
	public setAssignedUnits(units: U[]): void {
		this.assignedUnitIds.setValue(units.map(unit => unit.getId()));
	}

	/**
	 * Unassigns the supplied unit from the order.
	 * 
	 * @returns If the unit was assigned to the order and now isn't, else false.
	 */
	public removeUnit(unit: U): boolean {
		if (!this.isUnitAssigned(unit)) return false;

		this.assignedUnitIds.setValue(this.assignedUnitIds.getValue().filter(id => id !== unit.getId()));

		return true;
	}

	/**
	 * @returns If the supplied unit has been assigned to this order.
	 */
	public isUnitAssigned(unit: U): boolean {
		return this.assignedUnitIds.getValue().includes(unit.getId());
	}

	/**
	 * Implement execution code here.
	 */
	abstract onExecutionBegan(): void;

	public execute() {
		this.onExecutionBegan();
	}
}