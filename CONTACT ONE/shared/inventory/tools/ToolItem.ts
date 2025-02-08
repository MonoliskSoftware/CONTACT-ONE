/* eslint-disable @typescript-eslint/no-explicit-any */
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { ToolInterface } from "./ToolInterface";

export enum ToolState {
	IDLE,
	WILL_ACTIVATE,
	ACTIVATING,
	ACTIVE,
	/**
	 * The tool is running code to prepare for a deactivation. This code should be cancellable.
	*/
	WILL_DEACTIVATE,
	/**
	 * The tool is running code to college garbage and disconnect connections before it is completely disactivated. This is the point of no return.
	*/
	DEACTIVATING
}

/**
 * Tools represent functional Items. Use a ToolInterface to allow interaction between Tools and Entities.
 * 
 * Key terms:
 * - Equipped tools are in an inventory.
 * - Activated tools are ones that are equipped and in use.
 * - Soft deactivates are when a tool is deactivated via normal action (trying to remove from inventory, swap to other tool, etc.)
 * - Hard deactivates are when a tool is deactivated due to an abnormal action (garbage collection, inventory destruction, tool interface destruction, etc.)
 */
export abstract class ToolItem extends NetworkBehavior {
	public state = ToolState.IDLE;
	public currentWillActivatePromise: Promise<void> | undefined;
	public currentWillDeactivatePromise: Promise<void> | undefined;

	private currentDeactivationPromise: Promise<void> | undefined;
	private currentActivationPromise: Promise<void> | undefined;

	public readonly toolInterface = new NetworkVariable<ToolInterface<any>>(this, undefined!);

	protected abstract willActivate(): Promise<void>;
	protected abstract onActivating(): void;

	/**
	 * A callback that sometimes runs before an item is unequipped.
	 * 
	 * If some other process destroys the tool or anything else, the promise will be cancelled.
	 */
	protected abstract willDeactivate(): Promise<void>;
	
	/**
	 * Called right before it is fully deactivated.
	 * 
	 * Use for garbage collection, etc.
	 */
	protected abstract onDeactivating(): void;

	public async activate(toolInterface: ToolInterface<any>, soft = true): Promise<void> {
		if (this.state === ToolState.ACTIVE || this.state === ToolState.DEACTIVATING || this.state === ToolState.WILL_DEACTIVATE) {
			throw `An attempt to deactivate a tool was made during a bad state. Did you forget to deactivate it first?`;
			// When activate is called a second time during WILL_ACTIVATE, it is likely an attempt to promote a soft activation into a hard activation.
		} else if (this.state === ToolState.WILL_ACTIVATE) {
			if (!this.currentActivationPromise) throw `Current state is WILL_DEACTIVATE but no active deactivation promise was found. Deactivate was likely called from a bad context, or a state machine failure occurred earlier.`;

			// Cancelling the promise at this state promotes the activation to a hard one.
			this.currentActivationPromise.cancel();

			return;
		} else if (this.currentActivationPromise !== undefined) {
			throw `An attempt to activate a tool was made while activation was already in progress and the activation process was in an irreversible state.`;
		}

		return this.currentActivationPromise = new Promise((resolve, _, onCancel) => {
			onCancel(() => {
				switch (this.state) {
					case ToolState.WILL_ACTIVATE:
						/**
						 * The willActivate callback generally should be cancellable.
						 * 
						 * Cancelling this effectively promotes a soft activation to a hard activation.
						*/
						this.currentWillActivatePromise?.cancel();
						this.currentWillActivatePromise = undefined;

						this.state = ToolState.ACTIVATING;
						this.onActivating();
						this.state = ToolState.ACTIVE;

						break;
					case ToolState.ACTIVATING:
						this.onActivating();
						this.state = ToolState.ACTIVE;
				}
			});

			if (soft) {
				this.state = ToolState.WILL_ACTIVATE;

				(this.currentWillActivatePromise = this.willActivate()).await();
				this.currentWillActivatePromise = undefined;
			}

			this.state = ToolState.ACTIVATING;
			this.onActivating();
			this.state = ToolState.ACTIVE;

			this.currentActivationPromise = undefined;
			resolve();
		});
	}

	public async deactivate(toolInterface: ToolInterface<any>, soft = true): Promise<void> {
		if (this.state === ToolState.IDLE || this.state === ToolState.ACTIVATING || this.state === ToolState.WILL_ACTIVATE) {
			throw `An attempt to deactivate a tool was made during a bad state. Did you forget to activate it first?`;
			// When deactivate is called a second time during WILL_DEACTIVATE, it is likely an attempt to force a soft deactivation into a hard deactivation.
		} else if (this.state === ToolState.WILL_DEACTIVATE) {
			if (!this.currentDeactivationPromise) throw `Current state is WILL_DEACTIVATE but no active deactivation promise was found. Deactivate was likely called from a bad context, or a state machine failure occurred earlier.`;

			// Cancelling the promise at this state reverses the progress of deactivation and reverts the Tool to its ACTIVE state.
			this.currentDeactivationPromise.cancel();

			return;
		} else if (this.currentDeactivationPromise !== undefined) {
			throw `An attempt to deactivate a tool was made while deactivation was already in progress and the deactivation process was in an irreversible state.`;
		}

		return this.currentDeactivationPromise = new Promise((resolve, _, onCancel) => {
			onCancel(() => {
				switch (this.state) {
					case ToolState.WILL_DEACTIVATE:
						/**
						 * The willDeactivate state generally should be cancellable.
						*/
						this.currentWillDeactivatePromise?.cancel();
						this.currentWillDeactivatePromise = undefined;

						this.state = ToolState.ACTIVE;

						break;
					case ToolState.DEACTIVATING:
						this.onDeactivating();
						this.state = ToolState.IDLE;
				}
			});

			this.toolInterface.setValue(toolInterface);

			if (soft) {
				this.state = ToolState.WILL_DEACTIVATE;

				(this.currentWillDeactivatePromise = this.willDeactivate()).await();
				this.currentWillDeactivatePromise = undefined;
			}

			this.state = ToolState.DEACTIVATING;
			this.onDeactivating();
			this.state = ToolState.IDLE;

			this.currentDeactivationPromise = undefined;
			this.toolInterface.setValue(undefined!);
			resolve();
		});
	}

	public override remove(): void {
		if (this.state === ToolState.ACTIVE)
			this.deactivate(this.toolInterface.getValue(), false);
		else if (this.state === ToolState.WILL_DEACTIVATE || this.state === ToolState.DEACTIVATING)
			this.currentDeactivationPromise?.cancel();

		super.remove();
	}
}