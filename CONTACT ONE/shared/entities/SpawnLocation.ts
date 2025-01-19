import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { SpawnManager } from "../Scripts/Networking/SpawnManager";

export class SpawnLocation extends NetworkBehavior {
	public readonly factionTag: string = undefined as unknown as string;

	public onStart(): void {

	}

	public willRemove(): void {
		
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public static getSpawnLocationOfFaction(factionTag: string) {
		return SpawnManager.spawnedNetworkBehaviors.find(val => val instanceof SpawnLocation && val.factionTag === factionTag);
	}
}