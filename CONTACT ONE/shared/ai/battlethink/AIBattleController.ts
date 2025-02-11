/* eslint-disable @typescript-eslint/no-explicit-any */
import { PathfindingService, RunService } from "@rbxts/services";
import { Character, Rig } from "CONTACT ONE/shared/characters/Character";
import { Formations } from "CONTACT ONE/shared/characters/Formations";
import { CharacterController } from "CONTACT ONE/shared/controllers/CharacterController";
import { BattleUnit } from "CONTACT ONE/shared/stacks/organization/elements/BattleUnit";
import { CommandUnit } from "CONTACT ONE/shared/stacks/organization/elements/CommandUnit";
import { Unit } from "CONTACT ONE/shared/stacks/organization/elements/Unit";
import { BaseOrder } from "CONTACT ONE/shared/stacks/organization/orders/BaseOrder";
import { Constructable } from "CORP/shared/Libraries/Utilities";
import { SpawnManager } from "CORP/shared/Scripts/Networking/SpawnManager";
import { Pathfinding } from "../pathfinding/Pathfinding";
import { PATHFINDING_DEFAULT_PARAMETERS } from "../pathfinding/Pathfinding3";
import { DefaultMovement, FormationTripMovement, Movement, MoveToPositionMovement, TripMovement } from "./Movements";
import { OrderBehavior } from "./OrderBehavior";
import { Path3Test } from "./Path3Test";

const DEFAULT_BEHAVIOR_PRIORITY = -100;
const MIN_PHYSICAL_ATTACK_DISTANCE = 5;
const APPROACH_BEHAVIOR_PRIORITY = 99;
const ATTACK_BEHAVIOR_PRIORITY = 100;
const FORMATION_BEHAVIOR_PRIORITY = 0;

const UPDATE_INTERVAL_ENABLED = false;
const UPDATE_INTERVAL = .25;

export class AIBattleController extends CharacterController {
	// Utility references
	private characterReference!: Character;
	private humanoid!: Humanoid;
	private rig!: Rig;
	private unit!: Unit<any, any>;

	public pathfindingAgent!: Pathfinding.Agent;

	private pathfindingPromises: Promise<Pathfinding.AgentPath>[] = [];

	private heartbeatConnection: RBXScriptConnection | undefined;

	// Movements management
	private movementLayers: [DefaultMovement, number][] = [];
	private lastMovement: Movement | undefined = undefined;

	// Targeting
	private targetApproachMovement: TripMovement | undefined;
	private targetAttackMovement: MoveToPositionMovement | undefined;

	// Formations
	private formationMovement: FormationTripMovement | undefined;

	// Order management
	private currentOrder: BaseOrder<any, any> | undefined;
	private currentOrderBehavior: OrderBehavior<BaseOrder<any, any>> | undefined;

	private lastUpdate = 0;

	private movementNameValue: StringValue | undefined;

	//////////////////////////////
	// MOVEMENTS
	//////////////////////////////
	public addMovement<T extends Movement>(behavior: T, priority: number): T {
		this.movementLayers.push([behavior, priority]);
		this.sortMovementLayers();

		return behavior;
	}

	public instantiateMovement<T extends Movement>(behaviorClazz: Constructable<T>, name: string, priority: number, ...args: unknown[]): T {
		const behavior = new behaviorClazz(this, name, ...args) as T;

		this.movementLayers.push([behavior, priority]);
		this.sortMovementLayers();

		return behavior;
	}

	public getPriorityOf(movement: Movement) {
		return this.movementLayers.find(([otherMovement]) => otherMovement === movement)?.[1];
	}

	public removeMovement<T extends Movement>(behavior: T): T {
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

	//////////////////////////////
	// TASK SPECIFIC MOVEMENTS
	//////////////////////////////
	private instantiateTargetApproachMovement(target: Vector3) {
		if (this.targetApproachMovement) warn("Hey!");

		this.pathfindingPromises.push(new Promise(() => {
			const trip = this.pathfindingAgent.createTrip(target);

			this.targetApproachMovement = this.addMovement(new TripMovement(this, "AttackApproachMovement", trip), APPROACH_BEHAVIOR_PRIORITY);
		}));
	}

	//////////////////////////////
	// UPDATING
	//////////////////////////////
	private updateCurrentMovement(): Movement | undefined {
		const currentMovement = this.getCurrentMovement();

		if (currentMovement !== this.lastMovement) {
			this.lastMovement?.onActivatedChanged(false);

			this.lastMovement = currentMovement;

			currentMovement?.onActivatedChanged(true);
		}

		return currentMovement;
	}

	// private trackMovement: WrappedTripMovement
	private path3Test!: Path3Test;
	private path: Path = PathfindingService.CreatePath(PATHFINDING_DEFAULT_PARAMETERS);

	private update(deltaTime: number) {
		this.path3Test.update(deltaTime);
		// const targetPosition = (Workspace.FindFirstChild("Target") as BasePart).Position;

		// this.humanoid.MoveTo(Vector3.zero);

		// if (!UPDATE_INTERVAL_ENABLED || tick() - this.lastUpdate > UPDATE_INTERVAL) {
		// 	this.lastUpdate = tick();

		// 	deltaTime = UPDATE_INTERVAL_ENABLED ? UPDATE_INTERVAL : deltaTime;

		// 	this.updateAttack();

		// 	if (this.shouldScanForTargets()) this.scanForTargets();
		// 	if (this.shouldTryGetNewTarget() && this.unit.knownTargets.getValue().size() > 0) {
		// 		const target = this.unit.requestTarget();

		// 		print("Target acquired!");

		// 		if (target) this.characterReference.assignedTarget.setValue(target);
		// 	}

		// 	this.updateMovementIntoFormation();

		// 	const currentMovement = this.updateCurrentMovement();

		// 	if (currentMovement) currentMovement.update(deltaTime);

		// 	this.movementNameValue!.Value = currentMovement ? tostring(getmetatable(currentMovement)) : "none";
		// }
	}

	private updateStrike(distanceToTarget: number) {
		if (distanceToTarget < MIN_PHYSICAL_ATTACK_DISTANCE) {
			this.humanoid.Jump = true;
			this.humanoid.RootPart!.AssemblyAngularVelocity = new Vector3(0, 100, 0);
		}
	}

	private updateAttack() {
		const target = this.characterReference.assignedTarget.getValue();

		if (target) {
			const targetRig = target.rig.getValue();
			const targetPos = targetRig.GetPivot().Position;
			const distanceToTarget = targetPos.sub(this.rig.GetPivot().Position).Magnitude;

			this.updateStrike(distanceToTarget);

			if (distanceToTarget > Pathfinding.MIN_DISTANCE_FROM_GOAL_FOR_PATHFINDING) {
				if (this.targetAttackMovement) this.targetAttackMovement.enabled = false;

				if (!this.targetApproachMovement) {
					this.instantiateTargetApproachMovement(targetPos);
				} else if (targetPos.sub(this.targetApproachMovement.trip.goal).Magnitude > Pathfinding.MIN_DISTANCE_FROM_GOAL_FOR_RECALCULATION) {
					this.targetApproachMovement.dispose();
					this.targetApproachMovement = undefined;

					this.instantiateTargetApproachMovement(targetPos);
				}
			} else {
				if (this.targetApproachMovement) this.targetApproachMovement.enabled = false;
				if (this.targetAttackMovement) {
					this.targetAttackMovement.enabled = true;

					this.targetAttackMovement.target = targetPos;
				}
			}
		} else {
			if (this.targetApproachMovement) {
				this.targetApproachMovement.dispose();

				this.targetApproachMovement = undefined;
			}

			if (this.targetAttackMovement) this.targetAttackMovement.enabled = false;
		}
	}

	/**
	 * Called in update(), updates the character's progress into resuming formation.
	 */
	private updateMovementIntoFormation() {
		const shouldMoveIntoFormation = !this.characterReference.isCommander() && this.shouldMaintainFormation();

		if (this.formationMovement !== undefined) {
			if (shouldMoveIntoFormation) {
				const unit = this.unit;
				const index = unit.directMembers.indexOf(this.characterReference);

				const commanderOrigin = unit.commander.getValue().rig.getValue().GetPivot();

				const final = Formations.FormationComputers[unit.formation.getValue()](index);

				const targetPos = commanderOrigin.mul(new CFrame(final.X * 8, 0, final.Y * 8)).Position;
				this.formationMovement.updateTargetPosition(targetPos);
			}

			this.formationMovement.enabled = shouldMoveIntoFormation;
		} else {
			warn("No this.formationMovement");
		}
	}

	//////////////////////////////
	// CALLBACKS
	//////////////////////////////
	public onOrderReceived(order: BaseOrder<any, any>): void {
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

	//////////////////////////////
	// PREDICATES
	//////////////////////////////
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

	//////////////////////////////
	// TARGET MANAGEMENT
	//////////////////////////////
	public scanForTargets() {
		SpawnManager.spawnedNetworkBehaviors.forEach(behavior => {
			if (behavior instanceof Character) {
				const otherUnit = behavior.unit.getValue() as CommandUnit | BattleUnit;
				const thisUnit = this.unit as CommandUnit | BattleUnit;

				if (!otherUnit) warn(`No unit found for other ${behavior.getId()}`);
				if (!thisUnit) warn(`No unit found for this ${this.getId()}`);

				if (otherUnit && thisUnit && otherUnit.getFaction() !== thisUnit.getFaction()) {
					if (behavior.rig.getValue().GetPivot().Position.sub(this.rig.GetPivot().Position).Magnitude < 100)
						this.unit.tryReportTarget(behavior);
				}
			}
		});
	}

	public onStart(): void {
		if (RunService.IsServer()) {
			this.characterReference = this.character.getValue();
			this.humanoid = this.characterReference.getHumanoid();
			this.rig = this.characterReference.rig.getValue();
			this.unit = this.characterReference.unit.getValue();

			this.pathfindingAgent = new Pathfinding.Agent(this.humanoid);

			this.heartbeatConnection = RunService.Heartbeat.Connect(delta => this.update(delta));

			// Initialize with a dummy position - it will be updated in updateMovementIntoFormation
			this.formationMovement = this.addMovement(
				new FormationTripMovement(
					this,
					"FormationAssumptionMovement",
					this.pathfindingAgent,
					Vector3.zero
				),
				FORMATION_BEHAVIOR_PRIORITY
			);
			this.targetAttackMovement = this.addMovement(new MoveToPositionMovement(this, "AttackStrikeMovement", Vector3.zero), ATTACK_BEHAVIOR_PRIORITY);

			this.addMovement(new DefaultMovement(this, "Default"), DEFAULT_BEHAVIOR_PRIORITY);

			this.movementNameValue = new Instance("StringValue", this.rig.Parent?.Parent);

			this.path3Test = new Path3Test(this.humanoid);
		}
	}

	public willRemove(): void {
		this.currentOrderBehavior?.remove();
		this.heartbeatConnection?.Disconnect();
		this.pathfindingPromises.forEach(prom => prom.cancel());
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	static {
		Character.defaultController = this;
	}
}