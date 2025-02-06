import Object from "@rbxts/object-utils";
import { NetworkBehavior } from "./Scripts/Networking/NetworkBehavior";

const ALLOW_PROMOTION_TO_HARD_DEACTIVATION_ON_CLIENT = false;

enum ToolState {
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

abstract class ToolItem extends NetworkBehavior {
	public state = ToolState.IDLE;
	public currentWillActivatePromise: Promise<void> | undefined;
	public currentWillDeactivatePromise: Promise<void> | undefined;

	private currentDeactivationPromise: Promise<void> | undefined;
	private currentActivationPromise: Promise<void> | undefined;

	protected abstract willActivate(): Promise<void>;
	protected abstract onActivating(): void;

	protected abstract willDeactivate(): Promise<void>;
	protected abstract onDeactivating(): void;

	public async activate(soft = true): Promise<void> {
		if (this.state === ToolState.ACTIVE) {
			throw `An attempt to deactivate a tool was made during a bad state (ACTIVE). Did you forget to deactivate it first?`;
			// When activate is called a second time during WILL_ACTIVATE, it is likely an attempt to promote a soft activation into a hard activation.
		} else if (this.state === ToolState.WILL_ACTIVATE) {
			if (!this.currentActivationPromise) throw `Current state is WILL_DEACTIVATE but no active deactivation promise was found. Deactivate was likely called from a bad context, or a state machine failure occurred earlier.`;

			// Cancelling the promise at this state promotes the activation to a hard one.
			this.currentActivationPromise.cancel();

			return;
		} else if (this.currentDeactivationPromise !== undefined) {
			throw `An attempt to deactivate a tool was made while deactivation was already in progress and the deactivation process was in an irreversible state.`
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
				this.currentWillActivatePromise = undefined
			}

			this.state = ToolState.ACTIVATING;
			this.onActivating();
			this.state = ToolState.ACTIVE;

			this.currentActivationPromise = undefined;
			resolve();
		});
	}

	public async deactivate(soft = true): Promise<void> {
		if (this.state === ToolState.IDLE) {
			throw `An attempt to deactivate a tool was made during a bad state (IDLE). Did you forget to activate it first?`;
			// When deactivate is called a second time during WILL_DEACTIVATE, it is likely an attempt to force a soft deactivation into a hard deactivation.
		} else if (this.state === ToolState.WILL_DEACTIVATE) {
			if (!this.currentDeactivationPromise) throw `Current state is WILL_DEACTIVATE but no active deactivation promise was found. Deactivate was likely called from a bad context, or a state machine failure occurred earlier.`;

			// Cancelling the promise at this state reverses the progress of deactivation and reverts the Tool to its ACTIVE state.
			this.currentDeactivationPromise.cancel();

			return;
		} else if (this.currentDeactivationPromise !== undefined) {
			throw `An attempt to deactivate a tool was made while deactivation was already in progress and the deactivation process was in an irreversible state.`
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

			if (soft) {
				this.state = ToolState.WILL_DEACTIVATE;

				(this.currentWillDeactivatePromise = this.willDeactivate()).await();
				this.currentWillDeactivatePromise = undefined;
			}

			this.state = ToolState.DEACTIVATING;
			this.onDeactivating();
			this.state = ToolState.IDLE;

			this.currentDeactivationPromise = undefined;
			resolve();
		});
	}

	public override remove(): void {
		if (this.state === ToolState.ACTIVE)
			this.deactivate(false);
		else if (this.state === ToolState.WILL_DEACTIVATE || this.state === ToolState.DEACTIVATING)
			this.currentDeactivationPromise?.cancel();

		super.remove();
	}

	public onContextLost() {

	}

	public onContextGained() {

	}

	/**
	 * Try to deactivate the tool from the client.
	 */
	public tryDeactivate() {

	}
}

class ToolInterface extends NetworkBehavior {
	public currentTool: ToolItem | undefined;

	public async activateTool(tool: ToolItem): Promise<void> {
		if (this.currentTool) throw `A tool is already active, deactivate it first.`;

		if (tool.state === ToolState.ACTIVE) throw `The tool provided is already active.`;
	}

	public deactivateTool(tool: ToolItem): Promise<void> {
		return tool.deactivate().then(() => this.currentTool = undefined);
	}

	public onStart(): void {
		this.getNetworkObject().ownerChanged.connect(owner => );


	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}