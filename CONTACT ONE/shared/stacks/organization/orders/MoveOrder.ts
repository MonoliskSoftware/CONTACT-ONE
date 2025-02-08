import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { CommandUnit } from "../elements/CommandUnit";
import { BaseOrder } from "./BaseOrder";
import { MoveOrderBehavior } from "./MoveOrderBehavior";

export const MoveOrderParameters = {
	position: Vector3.zero
};

export class MoveOrder extends BaseOrder<CommandUnit, typeof MoveOrderParameters> {
	public readonly executionParameterSpecification = MoveOrderParameters;
	public readonly executionParameters = new NetworkVariable(this, this.executionParameterSpecification);
	public readonly orderBehavior = MoveOrderBehavior;

	public onStart(): void {
		super.onStart();
	}

	public willRemove(): void {
		super.willRemove();
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	constructor(gameObject: GameObject) {
		super(gameObject);
	}

	public onExecutionBegan() {
		// print(this.executionParameters.getValue());

		// this.getAssignedUnits().forEach(unit => unit.getMembersRecursive().forEach(member => member.getHumanoid().MoveTo(this.executionParameters.getValue().position)));
	}

	public getConfig() {
		return {
			name: "Move"
		};
	}
}