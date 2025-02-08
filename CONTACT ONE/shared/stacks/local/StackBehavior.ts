import React from "@rbxts/react";
import { RunService } from "@rbxts/services";
import { PlayerBehavior } from "CONTACT ONE/shared/players/PlayerBehavior";
import { PlayerState } from "CONTACT ONE/shared/players/PlayerState";
import { ServerSideOnly } from "CORP/shared/Libraries/Utilities";
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { RPC } from "CORP/shared/Scripts/Networking/RPC";
import { StackBehaviorState } from "./StackBehaviorState";

export interface StackComponentProps<T extends StackBehavior> {
	behavior: T;
}

/**
 * StackBehaviors are used to defined local behaviors for Stacks.
 */
export abstract class StackBehavior extends NetworkBehavior {
	public readonly playerBehavior = new NetworkVariable<PlayerBehavior>(this, undefined as unknown as PlayerBehavior);

	public readonly state = new NetworkVariable<StackBehaviorState>(this, StackBehaviorState.INITIALIZING);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public readonly abstract guiComponent: React.FC<StackComponentProps<any>>;

	private activated = false;

	/**
	 * Activates this StackBehavior. This should be reserved to the PlayerBehavior class. 
	 */
	public activate() {
		this.activated = true;
		if (RunService.IsServer()) this.state.setValue(StackBehaviorState.READY);
		this.onActivated();
	}

	/**
	 * Dectivates this StackBehavior. This should be reserved to the PlayerBehavior class. 
	 */
	public deactivate() {
		this.activated = false;
		this.willDeactivate();
	}

	public isActivated() {
		return this.activated;
	}

	public async onEliminated() {
		this.state.setValue(StackBehaviorState.ELIMINATED);
	}

	/**
	 * Following elimination, exits the player to the main menu.
	 */
	@ServerSideOnly
	public exit() {
		assert(this.playerBehavior.getValue().state.getValue() === PlayerState.ELIMINATED);
		
		this.playerBehavior.getValue().state.setValue(PlayerState.LOBBY);
	}

	@RPC.Method({
		accessPolicy: RPC.AccessPolicy.OWNER,
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER
	})
	public tryExit() {
		this.exit();
	}

	/**
	 * Called after this stack behavior is activated.
	 */
	abstract onActivated(): void;
	/**
	 * Called right before this stack behavior is deactivated.
	 */
	abstract willDeactivate(): void;

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	constructor(gameObject: GameObject) {
		super(gameObject);
	}
}