/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { Character, Rig } from "CONTACT ONE/shared/characters/Character";
import { Formations } from "CONTACT ONE/shared/characters/Formations";
import { BattleController } from "CONTACT ONE/shared/controllers/BattleController";
import { Unit } from "CONTACT ONE/shared/stacks/organization/elements/Unit";
import { BaseOrder } from "CONTACT ONE/shared/stacks/organization/orders/BaseOrder";
import { dict } from "CORP/shared/Libraries/Utilities";
import { OrderBehavior } from "./OrderBehavior";
import { CharacterPathfinder, Goal, GoalType } from "./Pathfinder3";

const DEFAULT_BEHAVIOR_PRIORITY = -100;
const MIN_PHYSICAL_ATTACK_DISTANCE = 5;
const APPROACH_BEHAVIOR_PRIORITY = 99;
const ATTACK_BEHAVIOR_PRIORITY = 100;
const FORMATION_BEHAVIOR_PRIORITY = 0;

const UPDATE_INTERVAL_ENABLED = false;
const UPDATE_INTERVAL = .25;

export interface Movement {
	enabled: boolean,
	goal: Goal
}

export function createMovement(goal: Goal, enabled = true): Movement {
	return {
		goal: goal,
		enabled: enabled
	} as Movement;
}

const FORMATION_RECALCULATION_THRESHOLD = 4;

export class AIBattleController extends BattleController {
	// Utility references
	private humanoid!: Humanoid;
	private rig!: Rig;
	private unit!: Unit<any, any>;

	// Connections
	private heartbeatConnection: RBXScriptConnection | undefined;

	// Movements management
	private movementLayers: [Movement, number][] = [];
	private lastMovement: Movement | undefined;

	// Formations
	private formationMovement: Movement | undefined;

	// Order management
	private currentOrder: BaseOrder<any> | undefined;
	private currentOrderBehavior: OrderBehavior<BaseOrder<any>> | undefined;

	private lastUpdate = 0;

	// Pathfinding
	private pathfinder!: CharacterPathfinder;
	public goalCompleted!: CharacterPathfinder["goalCompleted"];

	// Formations
	/**
	 * distance between units in the formation
	 */
	private currentFormationWidth = 8;

	private formationGoal: Goal = {
		position: Vector3.zero,
		type: GoalType.PATHFIND_TO,
		recalculationThreshold: FORMATION_RECALCULATION_THRESHOLD,
	};

	//#region Movements
	public addMovement(movement: Movement, priority: number): Movement {
		this.movementLayers.push([movement, priority]);
		this.sortMovementLayers();

		return movement;
	}

	public addMovementFromGoal(goal: Goal, priority: number): Movement {
		return this.addMovement(createMovement(goal), priority);
	}

	public getPriorityOf(movement: Movement) {
		return this.movementLayers.find(([otherMovement]) => otherMovement === movement)?.[1];
	}

	public removeMovement(behavior: Movement): Movement {
		this.movementLayers = this.movementLayers.filter(([layer]) => layer !== behavior);
		this.sortMovementLayers();

		return behavior;
	}

	private sortMovementLayers() {
		this.movementLayers.sort(([, a], [, b]) => a > b);
	}

	private getCurrentMovement() {
		return this.movementLayers.find(([movement]) => movement.enabled)?.[0];
	}
	//#endregion

	//#region Updating
	private updateCurrentMovement(): Movement | undefined {
		const currentMovement = this.getCurrentMovement();

		if (currentMovement !== this.lastMovement) {
			this.lastMovement = currentMovement;

			this.pathfinder.setCurrentGoal(currentMovement?.goal);
		}

		return currentMovement;
	}

	private update(deltaTime: number) {
		if (this.isEnabled()) {
			this.pathfinder.update();

			this.updateCurrentMovement();
			this.updateMovementIntoFormation();
		}
	}
	//#endregion

	//#region Formations
	/**
	 * todo: add raycast from commander to members
	 */
	private getFormationPosition() {
		const unit = this.unit;
		const index = unit.directMembers.indexOf(this.character);

		const commanderOrigin = unit.commander.getValue().rig.getValue().GetPivot();

		const final = Formations.FormationComputers[unit.formation.getValue()](index);

		return commanderOrigin.mul(new CFrame(final.X * 8, 0, final.Y * 8)).Position;
	}

	private updateMovementIntoFormation() {
		const shouldMoveIntoFormation = !this.character.isCommander() && this.shouldMaintainFormation();

		if (this.formationMovement !== undefined) {
			if (shouldMoveIntoFormation) this.formationGoal.position = this.getFormationPosition();

			this.formationMovement.enabled = shouldMoveIntoFormation;
		} else {
			warn("No this.formationMovement");
		}
	}
	//#endregion

	//#region Callbacks
	public onOrderReceived(order: BaseOrder<any>): void {
		if (RunService.IsServer()) {
			this.currentOrderBehavior?.remove();

			this.currentOrder = order;
			this.currentOrderBehavior = this.getGameObject().addComponent(order.orderBehavior, {
				order: order,
				character: this.character,
				controller: this
			});
		}
	}

	protected onControllerEnabled(): void {
		if (RunService.IsServer()) {
			this.humanoid = this.character.getHumanoid();
			this.rig = this.character.rig.getValue();
			this.unit = this.character.unit.getValue();

			this.pathfinder = new CharacterPathfinder(this.humanoid);
			this.goalCompleted = this.pathfinder.goalCompleted;
		}
	}

	protected onControllerDisabled(): void {

	}
	//#endregion

	//#region Predicates
	public shouldMaintainFormation(): boolean {
		return true;
	}

	/**
	 * TODO: needs a REAL implementation
	 */
	public shouldScanForTargets(): boolean {
		return math.random() < 0.1;
	}

	public shouldTryGetNewTarget(): boolean {
		return this.character.assignedTarget.getValue() === undefined;
	}
	//#endregion

	//#region Callbacks
	public onStart(): void {
		if (RunService.IsServer()) {
			this.heartbeatConnection = RunService.Heartbeat.Connect(delta => this.update(delta));

			// Setup formations
			this.formationMovement = this.addMovementFromGoal(this.formationGoal, FORMATION_BEHAVIOR_PRIORITY);
		}
	}

	public willRemove(): void {
		this.currentOrderBehavior?.remove();
		this.heartbeatConnection?.Disconnect();

		delete (this as dict).goalCompleted;
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public yieldUntilMovementCompleted(movement: Movement): Promise<Goal> {
		return Promise.fromEvent(this.goalCompleted, goal => movement.goal === goal);
	}

	static {
		Character.defaultController = this;
	}
}