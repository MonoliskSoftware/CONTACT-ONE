import { BaseElement } from "./BaseElement";

export class CommandUnit extends BaseElement {
	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}