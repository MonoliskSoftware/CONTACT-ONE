/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { BaseController } from "CONTACT ONE/shared/controllers/BaseController";
import { PlayerManager } from "CONTACT ONE/shared/players/PlayerManager";
import { Constructable, dict } from "CORP/shared/Libraries/Utilities";
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { ExtractNetworkVariables } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { Networking } from "CORP/shared/Scripts/Networking/Networking";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { RPC } from "CORP/shared/Scripts/Networking/RPC";
import { SpawnManager } from "CORP/shared/Scripts/Networking/SpawnManager";
import { SceneSerialization } from "CORP/shared/Scripts/Serialization/SceneSerialization";
import { GameStack } from "../../StackManager";
import { BaseOrder } from "../orders/BaseOrder";
import { BattleUnit } from "./BattleUnit";
import { Faction } from "./Faction";
import { Unit } from "./Unit";

/**
 * Command units are the highest level in the org hierarchy. The subordinates of a Command unit are always Battle units.
 */
export class CommandUnit extends Unit<Faction | CommandUnit, CommandUnit | BattleUnit> {
	public readonly controller = new NetworkVariable<BaseController>(this, undefined as unknown as BaseController);

	private lastParent: CommandUnit | Faction | undefined;
	private lastController: BaseController | undefined;

	public readonly subordinates: (CommandUnit | BattleUnit)[] = [];
	public readonly stack = GameStack.COMMAND_STACK;

	public onStart(): void {
		super.onStart();
		
		this.applyAncestry();

		this.parent.onValueChanged.connect(() => this.applyAncestry());
		this.controller.onValueChanged.connect(() => this.applyController());

	}

	public willRemove(): void {
		super.willRemove();
		
		this.lastParent = undefined;
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	/**
	 * Applies ancestry changes to NetworkVariables
	 */
	private applyAncestry() {
		const currentParent = this.parent.getValue();

		if (currentParent !== this.lastParent) {
			this.lastParent?.subordinateOnRemoved(this);

			currentParent?.subordinateOnAdded(this);

			this.lastParent = currentParent;
		}
	}

	/**
	 * Applies controller changes to NetworkVariables
	 */
	private applyController() {
		const currentController = this.controller.getValue();

		if (currentController !== this.lastController) {
			this.lastController?.commandUnitOnCommandRemoved(this);

			currentController?.commandUnitOnCommandTaken(this);

			this.lastController = currentController;
		}
	}

	public subordinateOnAdded(subordinate: CommandUnit | BattleUnit) {
		if (!this.subordinates.includes(subordinate)) this.subordinates.push(subordinate);

		this.subordinateAdded.fire(subordinate);
	}

	public subordinateOnRemoved(subordinate: CommandUnit | BattleUnit) {
		this.subordinateRemoving.fire(subordinate);

		this.subordinates.remove(this.subordinates.indexOf(subordinate));
	}

	public getFaction(): Faction | undefined {
		let parent = this.parent.getValue();

		while (parent) {
			if (parent instanceof Faction) return parent;

			parent = parent.parent?.getValue();
		}

		return undefined;
	}

	public createOrder<T extends BaseOrder<any, C>, C extends dict>(clazz: Constructable<T>, config: C | false): T {
		if (RunService.IsServer()) {
			const order = this.getGameObject().addComponent<BaseOrder<any, C>>(clazz, {
				initialNetworkVariableStates: ({
					originUnit: this,
					executionParameters: config ? config : undefined
				} satisfies ExtractNetworkVariables<BaseOrder<any, any>> as unknown as Map<string, Networking.NetworkableTypes>)
			});

			return order as T;
		} else {
			const id = this.createOrderFromClientToServer((clazz as unknown as T).getComponentPath(true), config);

			return SpawnManager.yieldForNetworkBehaviorById(id) as T;
		}
	}

	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER,
		returnMode: RPC.ReturnMode.RETURNS
	})
	private createOrderFromClientToServer<T extends BaseOrder<any, C>, C extends dict>(path: SceneSerialization.ComponentPath, config: C | false, incomingParams: RPC.IncomingParams = RPC.DefaultIncomingParams): string {
		assert(incomingParams.sender);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(incomingParams.sender);

		assert(behavior);
		assert(this.controller.getValue() === behavior);

		return this.createOrder(GameObject.getComponentClassFromPath<T>(path), config).getId();
	}
}