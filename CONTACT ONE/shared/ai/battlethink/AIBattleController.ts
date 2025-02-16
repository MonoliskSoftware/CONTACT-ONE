/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { Character, Rig } from "CONTACT ONE/shared/characters/Character";
import { Formations } from "CONTACT ONE/shared/characters/Formations";
import { CharacterController } from "CONTACT ONE/shared/controllers/CharacterController";
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

export class AIBattleController extends CharacterController {
	// Utility references
	private characterReference!: Character;
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

	//////////////////////////////
	// TASK SPECIFIC MOVEMENTS
	//////////////////////////////
	// private instantiateTargetApproachMovement(target: Vector3) {
	// 	if (this.targetApproachMovement) warn("Hey!");

	// 	this.pathfindingPromises.push(new Promise(() => {
	// 		const trip = this.pathfindingAgent.createTrip(target);

	// 		this.targetApproachMovement = this.addMovement(new TripMovement(this, "AttackApproachMovement", trip), APPROACH_BEHAVIOR_PRIORITY);
	// 	}));
	// }

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
		this.pathfinder.update();

		this.updateCurrentMovement();
		this.updateMovementIntoFormation();
	}

	private updateStrike(distanceToTarget: number) {
		if (distanceToTarget < MIN_PHYSICAL_ATTACK_DISTANCE) {
			this.humanoid.Jump = true;
			this.humanoid.RootPart!.AssemblyAngularVelocity = new Vector3(0, 100, 0);
		}
	}

	private updateAttack() {
		// const target = this.characterReference.assignedTarget.getValue();

		// if (target) {
		// 	const targetRig = target.rig.getValue();
		// 	const targetPos = targetRig.GetPivot().Position;
		// 	const distanceToTarget = targetPos.sub(this.rig.GetPivot().Position).Magnitude;

		// 	this.updateStrike(distanceToTarget);

		// 	if (distanceToTarget > Pathfinding.MIN_DISTANCE_FROM_GOAL_FOR_PATHFINDING) {
		// 		if (this.targetAttackMovement) this.targetAttackMovement.enabled = false;

		// 		if (!this.targetApproachMovement) {
		// 			this.instantiateTargetApproachMovement(targetPos);
		// 		} else if (targetPos.sub(this.targetApproachMovement.trip.goal).Magnitude > Pathfinding.MIN_DISTANCE_FROM_GOAL_FOR_RECALCULATION) {
		// 			this.targetApproachMovement.dispose();
		// 			this.targetApproachMovement = undefined;

		// 			this.instantiateTargetApproachMovement(targetPos);
		// 		}
		// 	} else {
		// 		if (this.targetApproachMovement) this.targetApproachMovement.enabled = false;
		// 		if (this.targetAttackMovement) {
		// 			this.targetAttackMovement.enabled = true;

		// 			this.targetAttackMovement.target = targetPos;
		// 		}
		// 	}
		// } else {
		// 	if (this.targetApproachMovement) {
		// 		this.targetApproachMovement.dispose();

		// 		this.targetApproachMovement = undefined;
		// 	}

		// 	if (this.targetAttackMovement) this.targetAttackMovement.enabled = false;
		// }
	}
	//#endregion

	//#region Formations
	/**
	 * todo: add raycast from commander to members
	 */
	private getFormationPosition() {
		const unit = this.unit;
		const index = unit.directMembers.indexOf(this.characterReference);

		const commanderOrigin = unit.commander.getValue().rig.getValue().GetPivot();

		const final = Formations.FormationComputers[unit.formation.getValue()](index);

		return commanderOrigin.mul(new CFrame(final.X * 8, 0, final.Y * 8)).Position;
	}

	private updateMovementIntoFormation() {
		const shouldMoveIntoFormation = !this.characterReference.isCommander() && this.shouldMaintainFormation();

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
				character: this.characterReference,
				controller: this
			});
		}
	}

	protected onControllerEnabled(): void {

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
		return this.characterReference.assignedTarget.getValue() === undefined;
	}
	//#endregion

	//#region Target management
	public scanForTargets() {
		// SpawnManager.spawnedNetworkBehaviors.forEach(behavior => {
		// 	if (behavior instanceof Character) {
		// 		const otherUnit = behavior.unit.getValue() as CommandUnit | BattleUnit;
		// 		const thisUnit = this.unit as CommandUnit | BattleUnit;

		// 		if (!otherUnit) warn(`No unit found for other ${behavior.getId()}`);
		// 		if (!thisUnit) warn(`No unit found for this ${this.getId()}`);

		// 		if (otherUnit && thisUnit && otherUnit.getFaction() !== thisUnit.getFaction()) {
		// 			if (behavior.rig.getValue().GetPivot().Position.sub(this.rig.GetPivot().Position).Magnitude < 100)
		// 				this.unit.tryReportTarget(behavior);
		// 		}
		// 	}
		// });
	}
	//#endregion

	//#region Callbacks
	public onStart(): void {
		if (RunService.IsServer()) {
			this.characterReference = this.character.getValue();
			this.humanoid = this.characterReference.getHumanoid();
			this.rig = this.characterReference.rig.getValue();
			this.unit = this.characterReference.unit.getValue();

			this.pathfinder = new CharacterPathfinder(this.humanoid);
			this.goalCompleted = this.pathfinder.goalCompleted;

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