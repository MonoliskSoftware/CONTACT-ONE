/* eslint-disable @typescript-eslint/no-explicit-any */
import { OrderBehavior } from "CONTACT ONE/shared/ai/battlethink/OrderBehavior";
import { PlayerManager } from "CONTACT ONE/shared/players/PlayerManager";
import { NetworkBehaviorVariableBinder } from "CONTACT ONE/shared/utilities/NetworkVariableBinder";
import { Constructable, dict, ServerSideOnly } from "CORP/shared/Libraries/Utilities";
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { RPC } from "CORP/shared/Scripts/Networking/RPC";
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
export abstract class BaseOrder<U extends Unit<any, any>, T extends dict> extends NetworkBehavior {
	public readonly assignedUnitIds = new NetworkVariable<string[]>(this, []);
	public readonly originUnit = new NetworkVariable(this, undefined as unknown as CommandUnit);

	public abstract getConfig(): OrderConfiguration;

	/**
	 * Defines specification for execution parameters.
	 */
	public readonly abstract executionParameterSpecification: T;

	/**
	 * Abstracted because we can't read executionParameterSpecification ourselves.
	 */
	public readonly abstract executionParameters: NetworkVariable<T>;

	/**
	 * Defines what OrderBehavior to use for AI.
	 */
	public readonly abstract orderBehavior: Constructable<OrderBehavior<any>>;

	private readonly originUnitBinder = new NetworkBehaviorVariableBinder(this as BaseOrder<any, any>, this.originUnit, "onOrderAdded", "onOrderRemoving");

	constructor(gameObject: GameObject) {
		super(gameObject);
	}

	public onStart(): void {
		this.originUnitBinder.start();
	}

	public willRemove(): void {
		this.originUnitBinder.teardown();
	}

	/**
	 * Assigns the supplied unit to this order.
	 * 
	 * @returns True if the unit was not assigned to this order and now is, else false.
	 */
	@ServerSideOnly
	public assignUnit(unit: U): boolean {
		if (this.isUnitAssigned(unit)) return false;

		this.assignedUnitIds.setValue([...this.assignedUnitIds.getValue(), unit.getId()]);

		return true;
	}

	/**
	 * Sets assigned units to the array provided.
	 */
	@ServerSideOnly
	public setAssignedUnits(units: U[]): void {
		this.assignedUnitIds.setValue(units.map(unit => unit.getId()));
	}

	/**
	 * Unassigns the supplied unit from the order.
	 * 
	 * @returns If the unit was assigned to the order and now isn't, else false.
	 */
	@ServerSideOnly
	public removeUnit(unit: U): boolean {
		if (!this.isUnitAssigned(unit)) return false;

		this.assignedUnitIds.setValue(this.assignedUnitIds.getValue().filter(id => id !== unit.getId()));

		return true;
	}

	/**
	 * @returns An array of units assigned to this order.
	 */
	public getAssignedUnits(): U[] {
		return this.assignedUnitIds.getValue().map(id => SpawnManager.getNetworkBehaviorById(id) as U);
	}

	/**
	 * @returns If the supplied unit has been assigned to this order.
	 */
	public isUnitAssigned(unit: U): boolean {
		return this.assignedUnitIds.getValue().includes(unit.getId());
	}

	/**
	 * Tries to assign the supplied unit to the order.
	 * 
	 * @returns Whether or not any change occurred.
	 */
	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER,
		returnMode: RPC.ReturnMode.RETURNS
	})
	public tryAssignUnit(unitId: string, params: RPC.IncomingParams = RPC.DefaultIncomingParams): boolean {
		assert(params.sender);

		const unit = SpawnManager.getNetworkBehaviorById(unitId) as Unit<any, any> | undefined;

		assert(unit);
		assert((unit.parent as NetworkVariable<Unit<any, any>>).getValue() === this.originUnit.getValue());

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		assert(behavior);
		assert(this.originUnit.getValue().controller.getValue() === behavior);

		return this.assignUnit(unit as U);
	}

	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER,
		returnMode: RPC.ReturnMode.RETURNS
	})
	public trySetAssignedUnits(unitIds: string[], params: RPC.IncomingParams = RPC.DefaultIncomingParams): void {
		assert(params.sender);

		// ADD BACK VALIDATION LATER
		// const unit = SpawnManager.getNetworkBehaviorById(unitId) as Unit<any, any> | undefined;

		// assert(unit);
		// assert((unit.parent as NetworkVariable<Unit<any, any>>).getValue() === this.originUnit.getValue());

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		assert(behavior);
		assert(this.originUnit.getValue().controller.getValue() === behavior);

		this.setAssignedUnits(unitIds.map(id => SpawnManager.getNetworkBehaviorById(id) as U));
	}

	/**
	 * 
	 */
	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER
	})
	public tryExecute(params: RPC.IncomingParams = RPC.DefaultIncomingParams) {
		assert(params.sender);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		assert(behavior);
		assert(this.originUnit.getValue().controller.getValue() === behavior);

		this.execute();
	}

	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER
	})
	public trySetParameters(orderParams: T, params: RPC.IncomingParams = RPC.DefaultIncomingParams) {
		assert(params.sender);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		assert(behavior);
		assert(this.originUnit.getValue().controller.getValue() === behavior);

		// Needs validation.
		this.executionParameters.setValue(orderParams);
	}

	/**
	 * Implement execution code here.
	 */
	abstract onExecutionBegan(): void;

	@ServerSideOnly
	public execute() {
		this.getAssignedUnits().forEach(unit => unit.getMembersRecursive().forEach(member => member.controller.getValue().onOrderReceived(this)));
		this.onExecutionBegan();
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}