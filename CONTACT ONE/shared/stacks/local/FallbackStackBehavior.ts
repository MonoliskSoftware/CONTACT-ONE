import React from "@rbxts/react";
import { StackBehavior } from "./StackBehavior";

/**
 * Used for cases when no stack is active, as a fallback.
 */
export class FallbackStackBehavior extends StackBehavior {
	public readonly guiComponent = () => React.createElement("TextButton");

	public onActivated(): void {
		// print("Fallback stack activating!");
	}
	
	public willDeactivate(): void {
		// print("Fallback stack deactivating!");
	}

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}