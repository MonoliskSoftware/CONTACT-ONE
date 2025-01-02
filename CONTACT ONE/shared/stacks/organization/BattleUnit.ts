import { BaseElement } from "./BaseElement";

export class BattleUnit extends BaseElement {
	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}