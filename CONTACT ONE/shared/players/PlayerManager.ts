import { Players, RunService } from "@rbxts/services";
import { GameObject } from "../Scripts/Componentization/GameObject";
import { ExtractNetworkVariables, NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { Networking } from "../Scripts/Networking/Networking";
import { NetworkObject } from "../Scripts/Networking/NetworkObject";
import { GamePlayer } from "./GamePlayer";

export class PlayerManager extends NetworkBehavior {
	private static singleton: PlayerManager;
	
	private players = new Map<Player, GamePlayer>();

	constructor(gameObject: GameObject) {
		super(gameObject);

		PlayerManager.singleton = this;
	}

	private createGamePlayer(player: Player) {
		const gameObject = new GameObject();

		gameObject.setName(player.Name);
		gameObject.setParent(this.getGameObject());
		gameObject.addComponent(NetworkObject);

		return gameObject.addComponent(GamePlayer, {
			initialNetworkVariableStates: ({
				player: player
			} satisfies ExtractNetworkVariables<GamePlayer> as unknown as Map<string, Networking.NetworkableTypes>)
		});
	}
	
	public onStart(): void {
		if (RunService.IsServer()) {
			Players.CharacterAutoLoads = false;

			Players.PlayerAdded.Connect(player => this.players.set(player, this.createGamePlayer(player)));
		}
	}

	public willRemove(): void {
		
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}