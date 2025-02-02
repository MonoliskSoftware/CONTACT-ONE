import { OrderBehavior } from "CONTACT ONE/shared/ai/battlethink/OrderBehavior";
import { GuardOrder } from "./GuardOrder";

export class GuardOrderBehavior extends OrderBehavior<GuardOrder> {
	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public onStart(): void {
		
	}

	public willRemove(): void {
		
	}

	public onExecuted(): void {
		
	}
}