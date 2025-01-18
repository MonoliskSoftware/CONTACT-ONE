import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { Unit } from "../elements/Unit";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface OrderConfiguration {

}

/**
 * Orders are used to define instructions for units. Order cans be given by players and by AI.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseOrder<U extends Unit<any, any>> extends NetworkBehavior {
	public readonly assignedUnit = new NetworkVariable(this, undefined as unknown as U);
	protected config: OrderConfiguration;

	constructor(gameObject: GameObject, config: OrderConfiguration) {
		super(gameObject);

		this.config = config;
	}
}