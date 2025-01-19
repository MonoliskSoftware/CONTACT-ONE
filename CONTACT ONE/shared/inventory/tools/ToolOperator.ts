import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";

/**
 * ToolOperators are used to provide an interface between entities (like a character or a vehicle) and tools.
 */
export class ToolOperator extends NetworkBehavior {
	public onStart(): void {
		
	}

	public willRemove(): void {
		
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}