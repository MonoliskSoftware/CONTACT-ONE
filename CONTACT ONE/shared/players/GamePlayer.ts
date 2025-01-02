import Object from "@rbxts/object-utils";
import { GameObject } from "../Scripts/Componentization/GameObject";
import { ExtractNetworkVariables, NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { Networking } from "../Scripts/Networking/Networking";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { FallbackStackBehavior } from "../stacks/local/FallbackStackBehavior";
import { StackBehavior } from "../stacks/local/StackBehavior";
import { GameStack, StackBehaviorConstructors } from "../stacks/StackManager";

export class GamePlayer extends NetworkBehavior {
	public readonly player = new NetworkVariable<Player>(this, undefined as unknown as Player);

	private currentStackBehavior: StackBehavior = this.getGameObject().addComponent(FallbackStackBehavior);
	public stack = new NetworkVariable<GameStack>(this, GameStack.COMMAND_STACK);
	private stackBehaviors = undefined as unknown as { [key in GameStack]: StackBehavior };

	public onStart(): void {
		this.stackBehaviors = this.initializeStackBehaviors();
		this.applyStack();
	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	private applyStack() {
		this.currentStackBehavior.deactivate();
		this.currentStackBehavior = this.stackBehaviors[this.stack.getValue()];
		this.currentStackBehavior.activate();
	}

	private initializeStackBehaviors() {
		return Object.fromEntries(Object.entries(StackBehaviorConstructors).map(([key, value]) => [key, this.getGameObject().addComponent(value, {
			initialNetworkVariableStates: ({
				gamePlayer: this
			} satisfies ExtractNetworkVariables<StackBehavior> as unknown as Map<string, Networking.NetworkableTypes>)
		})]));
	}

	constructor(gameObject: GameObject) {
		super(gameObject);
	}
}