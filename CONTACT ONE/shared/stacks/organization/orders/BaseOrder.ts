import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { BaseElement } from "../BaseElement";

export interface OrderConfiguration {

}

/**
 * Orders are used to define instructions for units. Order cans be given by players and by AI.
 */
export abstract class BaseOrder extends NetworkBehavior {
	public readonly assignedUnit = new NetworkVariable(this, undefined as unknown as BaseElement);
	protected config: OrderConfiguration;

	constructor(gameObject: GameObject, config: OrderConfiguration) {
		super(gameObject);

		this.config = config;
	}
}