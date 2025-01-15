import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { BaseOrder } from "./BaseOrder";

export class MoveOrder extends BaseOrder {
	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	constructor(gameObject: GameObject) {
		super(gameObject, {

		});
	}
}