import { Players, RunService } from "@rbxts/services";
import { Constructable } from "../Libraries/Utilities";
import { GameObject } from "../Scripts/Componentization/GameObject";
import { ExtractNetworkVariables, NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { Networking } from "../Scripts/Networking/Networking";
import { NetworkObject } from "../Scripts/Networking/NetworkObject";
import { PlayerBehavior } from "./PlayerBehavior";

export class PlayerManager extends NetworkBehavior {
	public static singleton: PlayerManager;
	public static localBehavior: PlayerBehavior;
	
	private static playerComponent: Constructable<PlayerBehavior>; 
	
	private players = new Map<Player, PlayerBehavior>();

	constructor(gameObject: GameObject) {
		super(gameObject);

		PlayerManager.singleton = this;
	}

	public static setPlayerComponent(clazz: Constructable<PlayerBehavior>) {
		this.playerComponent = clazz;
	}

	private createPlayerBehavior(player: Player) {
		const gameObject = new GameObject();

		gameObject.setName(player.Name);
		gameObject.setParent(this.getGameObject());
		gameObject.addComponent(NetworkObject).changeOwnership(player);

		const behavior = gameObject.addComponent(PlayerManager.playerComponent, {
			initialNetworkVariableStates: ({
				player: player
			} satisfies ExtractNetworkVariables<PlayerBehavior> as unknown as Map<string, Networking.NetworkableTypes>)
		});

		this.players.set(player, behavior);

		if (RunService.IsClient() && player === Players.LocalPlayer) PlayerManager.localBehavior = behavior;

		return behavior;
	}

	public getBehaviorFromPlayer(player: Player): PlayerBehavior {
		return this.players.get(player) as PlayerBehavior;
	}
	
	public onStart(): void {
		if (RunService.IsServer()) {
			Players.CharacterAutoLoads = false;

			Players.PlayerAdded.Connect(player => this.players.set(player, this.createPlayerBehavior(player)));
		}
	}

	public willRemove(): void {
		
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}