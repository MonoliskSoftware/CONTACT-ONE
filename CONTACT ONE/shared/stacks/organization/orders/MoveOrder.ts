import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { CommandUnit } from "../elements/CommandUnit";
import { BaseOrder } from "./BaseOrder";

export const MoveOrderParameters = {
	position: Vector3.zero
};

export class MoveOrder extends BaseOrder<CommandUnit, typeof MoveOrderParameters> {
	public readonly executionParameterSpecification = MoveOrderParameters;
	public readonly executionParameters = new NetworkVariable(this, this.executionParameterSpecification);

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
		this.getAssignedUnits().forEach(unit => unit.getDescendants().forEach(descendant => descendant.directMembers.forEach(member => member.getHumanoid().MoveTo(this.executionParameters.getValue().position))));
	}

	public getConfig() {
		return {
			name: "Move"
		};
	}
}