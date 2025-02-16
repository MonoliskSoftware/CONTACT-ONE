/* eslint-disable @typescript-eslint/no-explicit-any */
import { Character } from "CONTACT ONE/shared/characters/Character";
import { BaseOrder } from "CONTACT ONE/shared/stacks/organization/orders/BaseOrder";
import { Behavior } from "CORP/shared/Scripts/Componentization/Behavior";
import { AIBattleController } from "./AIBattleController";

/**
 * Used to execute character-specific code relating to orders. An instance of this will be attached to a Character when the order is executed.
 */
export abstract class OrderBehavior<T extends BaseOrder<any>> extends Behavior {
	public readonly order!: T;
	public readonly character!: Character;
	public readonly controller!: AIBattleController;

	public abstract onExecuted(): void;

	public getParameters(): T extends BaseOrder<infer P> ? P : never {
		return this.order.executionParameters.getValue();
	}
}
