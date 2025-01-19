import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { CommandUnit } from "../elements/CommandUnit";
import { BaseOrder, OrderConfiguration } from "./BaseOrder";

export interface MoveOrderParameters {
	position: Vector3
}

export class MoveOrder extends BaseOrder<CommandUnit, MoveOrderParameters> {
	public readonly config: OrderConfiguration = {
		name: "move"
	};

	public executionConfig: MoveOrderParameters = {
		position: Vector3.zero
	};

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	constructor(gameObject: GameObject) {
		super(gameObject);
	}

	public onExecutionBegan() {
		this.getAssignedUnits().forEach(unit => unit.getDescendants().forEach(descendant => descendant.directMembers.forEach(member => member.getHumanoid().MoveTo(this.executionConfig.position))));
	}
}