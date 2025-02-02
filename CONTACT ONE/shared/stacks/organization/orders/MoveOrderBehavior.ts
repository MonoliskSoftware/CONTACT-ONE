/* eslint-disable @typescript-eslint/no-explicit-any */
import { TripMovement } from "CONTACT ONE/shared/ai/battlethink/Movements";
import { OrderBehavior } from "CONTACT ONE/shared/ai/battlethink/OrderBehavior";
import { Pathfinding } from "CONTACT ONE/shared/ai/pathfinding/Pathfinding";
import { Connection } from "CORP/shared/Libraries/Signal";
import { MoveOrder } from "./MoveOrder";

const MOVE_ORDER_PRIORITY = 50;

export class MoveOrderBehavior extends OrderBehavior<MoveOrder> {
	private movement: TripMovement = undefined as unknown as TripMovement;
	private trip: Pathfinding.Trip = undefined as unknown as Pathfinding.Trip;
	private isCommanderChangedConnection: Connection<any> | undefined;

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public onStart(): void {
		this.trip = this.controller.pathfindingAgent.createTrip(this.order.executionParameters.getValue().position);
		this.movement = new TripMovement(this.controller, this.trip);
		this.movement.enabled = false;

		this.controller.addMovement(this.movement, MOVE_ORDER_PRIORITY);

		this.isCommanderChangedConnection = this.character.onIsCommanderChanged.connect(isCommander => this.update(isCommander));
		this.update();
	}

	public willRemove(): void {
		this.isCommanderChangedConnection?.disconnect();
		this.trip.dispose();
		this.controller.removeMovement(this.movement);
	}

	public onExecuted(): void {

	}

	public update(isCommander = this.character.isCommander()) {
		if (isCommander) {
			this.movement.trip.recalculate();
			this.movement.enabled = true;
		} else {
			this.movement.enabled = false;
		}
	}
}