import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { CommandUnit } from "../elements/CommandUnit";
import { BaseOrder } from "./BaseOrder";

export const GuardOrderParameters = {
	
};

export class GuardOrder extends BaseOrder<CommandUnit, typeof GuardOrderParameters> {
	public readonly executionParameterSpecification = GuardOrderParameters;
	public readonly executionParameters = new NetworkVariable(this, this.executionParameterSpecification);

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
		
	}

	public getConfig() {
		return {
			name: "Guard"
		};
	}
}