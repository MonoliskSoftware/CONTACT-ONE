import { StackBehavior } from "./StackBehavior";

export class BattleStackBehavior extends StackBehavior {
	public onActivated(): void {
		print("Battle stack activating!");
	}
	
	public willDeactivate(): void {
		print("Battle stack deactivating!");
	}

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}