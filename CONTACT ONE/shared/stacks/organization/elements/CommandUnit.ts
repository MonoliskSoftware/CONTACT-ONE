/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { BaseController } from "CONTACT ONE/shared/controllers/BaseController";
import { PlayerManager } from "CONTACT ONE/shared/players/PlayerManager";
import { NetworkVariableBinder } from "CONTACT ONE/shared/utilities/NetworkVariableBinder";
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

type CommandUnitParent = CommandUnit | Faction;

/**
 * Command units are the highest level in the org hierarchy. The subordinates of a Command unit are always Battle units.
 */
export class CommandUnit extends Unit<CommandUnitParent, CommandUnit | BattleUnit> {
	public readonly controller = new NetworkVariable<BaseController>(this, undefined!);

	public readonly subordinates: (CommandUnit | BattleUnit)[] = [];
	// public readonly associatedOrders: BaseOrder<any, any>[] = [];
	public readonly stack = GameStack.COMMAND_STACK;

	private readonly controllerBinder = new NetworkVariableBinder<BaseController, CommandUnit>(this, this.controller, "commandUnitOnCommandTaken", "commandUnitOnCommandRemoved");

	// public onOrderAdded(order: BaseOrder<any, any>) {
	// 	if (!this.associatedOrders.includes(order)) this.associatedOrders.push(order);
	// }

	// public onOrderRemoving(order: BaseOrder<any, any>) {
	// 	this.associatedOrders.remove(this.associatedOrders.indexOf(order));
	// }
	
	public onStart(): void {
		super.onStart();
		
		this.controllerBinder.start();
	}

	public willRemove(): void {
		super.willRemove();

		this.controllerBinder.teardown();
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public subordinateOnAdded(subordinate: CommandUnit | BattleUnit) {
		if (!this.subordinates.includes(subordinate)) this.subordinates.push(subordinate);

		this.subordinateAdded.fire(subordinate);
	}

	public subordinateOnRemoved(subordinate: CommandUnit | BattleUnit) {
		warn("removing a subordinate", getmetatable(subordinate));
		this.subordinateRemoving.fire(subordinate);

		this.subordinates.remove(this.subordinates.indexOf(subordinate));

		if (RunService.IsServer()) super.checkIfShouldDestroy();
	}

	public getFaction(): Faction {
		let parent = this.parent.getValue();

		while (parent) {
			if (parent instanceof Faction) return parent;

			parent = parent.parent?.getValue();
		}

		throw `No faction!`;
	}

	public createOrder<T extends BaseOrder<C>, C extends dict>(clazz: Constructable<T>, config: C | false): T {
		if (RunService.IsServer()) {
			const order = this.getGameObject().addComponent<BaseOrder<C>>(clazz, {
				initialNetworkVariableStates: ({
					owner: this.commander.getValue(),
					executionParameters: config ? config : undefined
				} satisfies ExtractNetworkVariables<BaseOrder<any>> as unknown as Map<string, Networking.NetworkableTypes>)
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
	private createOrderFromClientToServer<T extends BaseOrder<C>, C extends dict>(path: SceneSerialization.ComponentPath, config: C | false, incomingParams: RPC.IncomingParams = RPC.DefaultIncomingParams): string {
		assert(incomingParams.sender);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(incomingParams.sender);

		assert(behavior);
		assert(this.controller.getValue() === behavior);

		return this.createOrder(GameObject.getComponentClassFromPath<T>(path), config).getId();
	}
}