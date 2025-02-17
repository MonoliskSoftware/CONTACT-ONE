/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { PlayerManager } from "CONTACT ONE/shared/players/PlayerManager";
import { Constructable, dict } from "CORP/shared/Libraries/Utilities";
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { ExtractNetworkVariables, NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { Networking } from "CORP/shared/Scripts/Networking/Networking";
import { RPC } from "CORP/shared/Scripts/Networking/RPC";
import { SpawnManager } from "CORP/shared/Scripts/Networking/SpawnManager";
import { SceneSerialization } from "CORP/shared/Scripts/Serialization/SceneSerialization";
import { BaseOrder } from "./BaseOrder";

export class OrderManager extends NetworkBehavior {
	public static singleton: OrderManager;

	constructor(gameObject: GameObject) {
		super(gameObject);

		OrderManager.singleton = this;
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public onStart(): void {

	}

	public willRemove(): void {

	}

	public createOrder<T extends BaseOrder<C>, C extends dict>(clazz: Constructable<T>, owner: Character, config: C | false): T {
		if (RunService.IsServer()) {
			const order = this.getGameObject().addComponent<BaseOrder<C>>(clazz, {
				initialNetworkVariableStates: ({
					owner: owner,
					executionParameters: config ? config : undefined
				} satisfies ExtractNetworkVariables<BaseOrder<any>> as unknown as Map<string, Networking.NetworkableTypes>)
			});

			return order as T;
		} else {
			const id = this.createOrderFromClientToServer((clazz as unknown as T).getComponentPath(true), owner.getId(), config);

			return SpawnManager.yieldForNetworkBehaviorById(id) as T;
		}
	}

	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER,
		returnMode: RPC.ReturnMode.RETURNS
	})
	private createOrderFromClientToServer<T extends BaseOrder<C>, C extends dict>(path: SceneSerialization.ComponentPath, ownerId: string, config: C | false, incomingParams: RPC.IncomingParams = RPC.DefaultIncomingParams): string {
		assert(incomingParams.sender);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(incomingParams.sender);

		assert(behavior);

		const owner = SpawnManager.getNetworkBehaviorById<Character>(ownerId);

		assert(owner);
		// assert(owner.unit.getValue().controller.getValue() === behavior);

		return this.createOrder(GameObject.getComponentClassFromPath<T>(path), owner, config).getId();
	}
}