/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { createMovement, Movement } from "CONTACT ONE/shared/ai/battlethink/AIBattleController";
import { OrderBehavior } from "CONTACT ONE/shared/ai/battlethink/OrderBehavior";
import { GoalType } from "CONTACT ONE/shared/ai/battlethink/Pathfinder3";
import { Character, Rig } from "CONTACT ONE/shared/characters/Character";
import { SpawnManager } from "CORP/shared/Scripts/Networking/SpawnManager";
import { AttackOrder } from "./AttackOrder";

const ATTACK_ORDER_PRIORITY = 60;

export class AttackOrderBehavior extends OrderBehavior<AttackOrder> {
	private movement!: Movement;
	private rig!: Rig;
	private target!: Character;
	private conn!: RBXScriptConnection;

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public onStart(): void {
		this.target = SpawnManager.getNetworkBehaviorById<Character>(this.getParameters().characterId as unknown as string)!;
		this.rig = this.character.rig.getValue();
		this.movement = createMovement({
			position: this.rig.GetPivot().Position,
			type: GoalType.PATHFIND_TO
		}, false);

		this.controller.addMovement(this.movement, ATTACK_ORDER_PRIORITY);

		this.conn = RunService.Heartbeat.Connect(() => this.update());

		this.target.died.connect(() => {
			this.controller.removeMovement(this.movement);
			this.conn.Disconnect();
		});
	}

	public willRemove(): void {

	}

	public onExecuted(): void {

	}

	public update() {
		this.movement.goal.position = this.rig.GetPivot().Position;
	}

	public onTargetEliminated() {

	}
}