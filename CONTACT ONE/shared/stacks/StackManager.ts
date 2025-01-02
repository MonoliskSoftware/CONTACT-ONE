import { Constructable } from "../Libraries/Utilities";
import { GameObject } from "../Scripts/Componentization/GameObject";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { BattleStackBehavior } from "./local/BattleStackBehavior";
import { CommandStackBehavior } from "./local/CommandStackBehavior";
import { StackBehavior } from "./local/StackBehavior";

export enum GameStack {
	BATTLE_STACK,
	COMMAND_STACK
}

export const StackBehaviorConstructors = {
	[GameStack.BATTLE_STACK]: BattleStackBehavior,
	[GameStack.COMMAND_STACK]: CommandStackBehavior,
} as { [key in GameStack]: Constructable<StackBehavior> };

export class StackManager extends NetworkBehavior {
	private static singleton: StackManager;

	constructor(gameObject: GameObject) {
		super(gameObject);

		StackManager.singleton = this;
	}

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}