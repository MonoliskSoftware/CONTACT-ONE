import React from "@rbxts/react";
import { PlayerBehavior } from "CONTACT ONE/shared/players/PlayerBehavior";
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";

export interface StackComponentProps<T extends StackBehavior> {
	behavior: T;
}

/**
 * StackBehaviors are used to defined local behaviors for Stacks.
 */
export abstract class StackBehavior extends NetworkBehavior {
	public readonly playerBehavior = new NetworkVariable<PlayerBehavior>(this, undefined as unknown as PlayerBehavior);

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public readonly abstract guiComponent: React.FC<StackComponentProps<any>>;

	/**
	 * Activates this StackBehavior. This should be reserved to the PlayerBehavior class. 
	 */
	public activate() {
		this.onActivated();
	}

	/**
	 * Dectivates this StackBehavior. This should be reserved to the PlayerBehavior class. 
	 */
	public deactivate() {
		this.willDeactivate();
	}

	/**
	 * Called after this stack behavior is activated.
	 */
	abstract onActivated(): void;
	/**
	 * Called right before this stack behavior is deactivated.
	 */
	abstract willDeactivate(): void;

	constructor(gameObject: GameObject) {
		super(gameObject);
	}
}