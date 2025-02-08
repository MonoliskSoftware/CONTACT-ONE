import { AIBattleController } from "../ai/battlethink/AIBattleController";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { Character } from "./Character";

export class CharacterControllerManager extends NetworkBehavior {
	public onStart(): void {
		
	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	static {
		Character.defaultController = AIBattleController;
	}
}