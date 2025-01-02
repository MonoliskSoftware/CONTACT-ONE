import { StackBehavior } from "./StackBehavior";

/**
 * Used for cases when no stack is active
 */
export class FallbackStackBehavior extends StackBehavior {
	public onActivated(): void {
		print("Fallback stack activating!");
	}
	
	public willDeactivate(): void {
		print("Fallback stack deactivating!");
	}

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}