import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";

export class Faction extends NetworkBehavior {
	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}