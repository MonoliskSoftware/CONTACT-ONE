import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { AttackOrderBehavior } from "./AttackOrderBehavior";
import { BaseOrder } from "./BaseOrder";

export const AttackOrderParameters = {
	characterId: string
};

export class AttackOrder extends BaseOrder<typeof AttackOrderParameters> {
	public readonly executionParameterSpecification = AttackOrderParameters;
	public readonly executionParameters = new NetworkVariable(this, this.executionParameterSpecification);
	public readonly orderBehavior = AttackOrderBehavior;

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
			name: "Attack"
		};
	}
}