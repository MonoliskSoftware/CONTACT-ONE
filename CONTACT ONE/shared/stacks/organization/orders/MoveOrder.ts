import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { CommandUnit } from "../elements/CommandUnit";
import { BaseOrder } from "./BaseOrder";

export class MoveOrder extends BaseOrder<CommandUnit> {
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