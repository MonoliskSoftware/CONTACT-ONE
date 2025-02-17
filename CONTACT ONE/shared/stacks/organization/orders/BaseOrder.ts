/* eslint-disable @typescript-eslint/no-explicit-any */
import { OrderBehavior } from "CONTACT ONE/shared/ai/battlethink/OrderBehavior";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { PlayerManager } from "CONTACT ONE/shared/players/PlayerManager";
import { Constructable, dict, ServerSideOnly } from "CORP/shared/Libraries/Utilities";
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkList } from "CORP/shared/Scripts/Networking/NetworkList";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { RPC } from "CORP/shared/Scripts/Networking/RPC";
import { SpawnManager } from "CORP/shared/Scripts/Networking/SpawnManager";
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

export interface IElementActor extends NetworkBehavior {
	onOrderAdded(order: BaseOrder<any>): void;
	onOrderRemoving(order: BaseOrder<any>): void;
}

export type ElementActor = Unit<any, any> | Character;

/**
 * Orders are used to define instructions for units. Order cans be given by players and by AI.
 */
export abstract class BaseOrder<T extends dict> extends NetworkBehavior {
	public readonly assignedActors = new NetworkList<IElementActor>(this);
	public readonly owner = new NetworkVariable<Character>(this, undefined!);

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

	// private readonly originUnitBinder = new NetworkBehaviorVariableBinder(this as BaseOrder<any, any>, this.originActor, "onOrderAdded", "onOrderRemoving");

	constructor(gameObject: GameObject) {
		super(gameObject);
	}

	public onStart(): void {
		// this.owner
		// this.originUnitBinder.start();
	}

	public willRemove(): void {
		// this.originUnitBinder.teardown();
	}

	// /**
	//  * DOCS OUTDATED - ACTOR UPDATE
	//  * 
	//  * Assigns the supplied unit to this order.
	//  * 
	//  * @returns True if the unit was not assigned to this order and now is, else false.
	//  */
	// @ServerSideOnly
	// public assignActor(unit: U): boolean {
	// 	if (this.isActorAssigned(unit)) return false;

	// 	this.assignedActors.push(unit);

	// 	return true;
	// }

	/**
	 * DOCS OUTDATED - ACTOR UPDATE
	 * 
	 * Sets assigned units to the array provided.
	 */
	@ServerSideOnly
	public setAssignedActors(units: IElementActor[]): void {
		this.assignedActors.setValue(units);
	}

	// /**
	//  * DOCS OUTDATED - ACTOR UPDATE
	//  * 
	//  * Unassigns the supplied unit from the order.
	//  * 
	//  * @returns If the unit was assigned to the order and now isn't, else false.
	//  */
	// @ServerSideOnly
	// public removeActor(unit: IElementActor): boolean {
	// 	if (!this.isActorAssigned(unit)) return false;

	// 	this.assignedActors.setValue(this.assignedActors.getValue().filter(id => id !== unit));

	// 	return true;
	// }

	/**
	 * DOCS OUTDATED - ACTOR UPDATE
	 * 
	 * @returns An array of units assigned to this order.
	 */
	public getAssignedActors(): IElementActor[] {
		return this.assignedActors.getValue();
	}

	/**
	 * DOCS OUTDATED - ACTOR UPDATE
	 * 
	 * @returns If the supplied unit has been assigned to this order.
	 */
	public isActorAssigned(actor: IElementActor): boolean {
		return this.assignedActors.includes(actor);
	}

	// /**
	//  * DOCS OUTDATED - ACTOR UPDATE
	//  * 
	//  * Tries to assign the supplied unit to the order.
	//  * 
	//  * @returns Whether or not any change occurred.
	//  */
	// @RPC.Method({
	// 	allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER,
	// 	returnMode: RPC.ReturnMode.RETURNS
	// })
	// public tryAssignUnit(unitId: string, params: RPC.IncomingParams = RPC.DefaultIncomingParams): boolean {
	// 	assert(params.sender);

	// 	const unit = SpawnManager.getNetworkBehaviorById(unitId) as U | undefined;

	// 	assert(unit);
	// 	assert((unit.parent as NetworkVariable<Unit<any, any>>).getValue() === this.originActor.getValue());

	// 	const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

	// 	assert(behavior);
	// 	assert(this.originActor.getValue().controller.getValue() === behavior);

	// 	return this.assignActor(unit as U);
	// }

	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER,
		returnMode: RPC.ReturnMode.RETURNS
	})
	public trySetAssignedActors(unitIds: string[], params: RPC.IncomingParams = RPC.DefaultIncomingParams): void {
		assert(params.sender);

		// ADD BACK VALIDATION LATER
		// const unit = SpawnManager.getNetworkBehaviorById(unitId) as Unit<any, any> | undefined;

		// assert(unit);
		// assert((unit.parent as NetworkVariable<Unit<any, any>>).getValue() === this.originUnit.getValue());

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		assert(behavior);
		// assert(this.originUnit.getValue().controller.getValue() === behavior);

		this.setAssignedActors(unitIds.map(id => SpawnManager.getNetworkBehaviorById(id) as IElementActor));
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
		// assert(this.originUnit.getValue().controller.getValue() === behavior);

		this.execute();
	}

	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER
	})
	public trySetParameters(orderParams: T, params: RPC.IncomingParams = RPC.DefaultIncomingParams) {
		assert(params.sender);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		assert(behavior);
		// assert(this.originUnit.getValue().controller.getValue() === behavior);

		// Needs validation.
		this.executionParameters.setValue(orderParams);
	}

	@ServerSideOnly
	public execute() {
		const handleMember = (member: Character) => member.getController().onOrderReceived(this);

		this.getAssignedActors().forEach(actor => actor instanceof Character ? handleMember(actor) : (actor as unknown as Unit<any, any>).getMembersRecursive().forEach(handleMember));
		this.onExecutionBegan();
	}

	/**
	 * Implement execution code here.
	 */
	abstract onExecutionBegan(): void;

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}