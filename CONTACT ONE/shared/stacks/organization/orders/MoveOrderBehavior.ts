/* eslint-disable @typescript-eslint/no-explicit-any */
import { createMovement, Movement } from "CONTACT ONE/shared/ai/battlethink/AIBattleController";
import { OrderBehavior } from "CONTACT ONE/shared/ai/battlethink/OrderBehavior";
import { GoalType } from "CONTACT ONE/shared/ai/battlethink/Pathfinder3";
import { Connection } from "CORP/shared/Libraries/Signal";
import { MoveOrder } from "./MoveOrder";

const MOVE_ORDER_PRIORITY = 50;

export class MoveOrderBehavior extends OrderBehavior<MoveOrder> {
	private movement!: Movement;
	private isCommanderChangedConnection: Connection<any> | undefined;

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public onStart(): void {
		this.movement = createMovement({
			position: this.getParameters().position,
			type: GoalType.PATHFIND_TO
		}, false);

		this.controller.addMovement(this.movement, MOVE_ORDER_PRIORITY);
		this.controller.yieldUntilMovementCompleted(this.movement).then(() => this.controller.removeMovement(this.movement));

		// Bug, changing commander will cause override to deactivate
		this.isCommanderChangedConnection = this.character.onIsCommanderChanged.connect(isCommander => this.update(isCommander));
		this.update();
	}

	public willRemove(): void {
		this.isCommanderChangedConnection?.disconnect();
		this.controller.removeMovement(this.movement);
	}

	public onExecuted(): void {

	}

	public update(isCommander = this.shouldMove()) {
		this.movement.enabled = isCommander;
	}

	public shouldMove() {
		return true;
		// return this.character.isCommander()
	}
}