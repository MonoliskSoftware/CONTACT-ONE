/* eslint-disable @typescript-eslint/no-explicit-any */
import { Character } from "../characters/Character";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { BaseOrder } from "../stacks/organization/orders/BaseOrder";

export abstract class BattleController extends NetworkBehavior {
	public character!: Character;

	public abstract onOrderReceived(order: BaseOrder<any>): void;

	private enabled = false;

	protected abstract onControllerEnabled(): void;
	protected abstract onControllerDisabled(): void;

	protected isEnabled() {
		return this.enabled;
	}

	public enable(isEnabled = true) {
		this.enabled = isEnabled;

		if (isEnabled)
			this.onControllerEnabled();
		else
			this.onControllerDisabled();
	}

	public disable() {
		this.enable(false);
	}
}