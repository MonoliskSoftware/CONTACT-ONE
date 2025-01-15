import { Players, RunService } from "@rbxts/services";
import { GameObject } from "../Scripts/Componentization/GameObject";
import { ExtractNetworkVariables, NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { Networking } from "../Scripts/Networking/Networking";
import { NetworkObject } from "../Scripts/Networking/NetworkObject";
import { PlayerBehavior } from "./PlayerBehavior";

export class PlayerManager extends NetworkBehavior {
	private static singleton: PlayerManager;
	
	private players = new Map<Player, PlayerBehavior>();

	constructor(gameObject: GameObject) {
		super(gameObject);

		PlayerManager.singleton = this;
	}

	private createPlayerBehavior(player: Player) {
		const gameObject = new GameObject();

		gameObject.setName(player.Name);
		gameObject.setParent(this.getGameObject());
		gameObject.addComponent(NetworkObject).changeOwnership(player);

		return gameObject.addComponent(PlayerBehavior, {
			initialNetworkVariableStates: ({
				player: player
			} satisfies ExtractNetworkVariables<PlayerBehavior> as unknown as Map<string, Networking.NetworkableTypes>)
		});
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