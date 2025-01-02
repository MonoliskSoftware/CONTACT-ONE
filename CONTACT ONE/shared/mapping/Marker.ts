import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";

export class Marker extends NetworkBehavior {
	/**
	 * Whether the marker is enabled and should be visible on screens.
	 */
	public enabled = new NetworkVariable<boolean>(this, false);
	public icon = new NetworkVariable<string>(this, "");

	public onStart(): void {
		
	}

	public willRemove(): void {
		
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}