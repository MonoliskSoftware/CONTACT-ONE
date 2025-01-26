/* eslint-disable @typescript-eslint/no-explicit-any */
import { CollectionService, RunService } from "@rbxts/services";
import { SpawnLocation } from "../entities/SpawnLocation";
import Collector from "../Libraries/GarbageCollector";
import { Signal } from "../Libraries/Signal";
import { ServerSideOnly, Utilities } from "../Libraries/Utilities";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { SpawnManager } from "../Scripts/Networking/SpawnManager";
import { BattleUnit } from "../stacks/organization/elements/BattleUnit";
import { CommandUnit } from "../stacks/organization/elements/CommandUnit";
import { GenericUnit, Unit } from "../stacks/organization/elements/Unit";
import { BaseOrder } from "../stacks/organization/orders/BaseOrder";
import { GuardOrder } from "../stacks/organization/orders/GuardOrder";
import { MoveOrder } from "../stacks/organization/orders/MoveOrder";
import { Pathfinding } from "./battlethink/Pathfinding";
import { CharacterPhysics } from "./CharacterPhysics";
import { Formations } from "./Formations";

const PathToRig = "CONTACT ONE/assets/prefabs/HumanoidRig";

/**
 * A rig is the physical component of a Character.
 */
export interface Rig extends Model {
	Humanoid: Humanoid,
	HumanoidRootPart: BasePart,
}

export class Character extends NetworkBehavior {
	/**
	 * Reference to the unit this character is assigned to, or undefined if none.
	 */
	public readonly unit = new NetworkVariable(this, undefined as unknown as Unit<any, any>);

	/**
	 * Reference to the rig instance.
	 */
	public readonly rig = new NetworkVariable<Rig>(this, undefined as unknown as Rig);

	public readonly assignedTarget = new NetworkVariable<Character>(this, undefined as unknown as Character);

	public readonly onIsCommanderChanged = new Signal<[boolean]>(`${this.getId()}IsCommanderChanged`);
	public readonly died = new Signal<[]>(`characterOnDied`);

	private readonly collector = new Collector();

	private currentOrder: BaseOrder<any, any> | undefined;
	private lastUnit: GenericUnit | undefined;
	private pathfindingAgent = undefined as unknown as Pathfinding.Agent;

	// Guard order state
	private assignedGuardNode: Vector3 | undefined;
	/**
	 * Used to keep track of the current goal position, set by different orders. When the character is done doing something different, like attacking an enemy, it will pathfind its way here.
	 */
	private intendedGoal: Vector3 | undefined;

	public onStart(): void {
		if (RunService.IsServer()) {
			this.initializeRig();

			this.pathfindingAgent = new Pathfinding.Agent(this.getHumanoid());

			this.rig.getValue().PivotTo(SpawnLocation.getSpawnLocationOfFaction((this.unit.getValue() as CommandUnit | BattleUnit).getFaction()?.name.getValue() ?? "")?.getGameObject().getInstance().GetPivot() ?? CFrame.identity);

			this.collector.add(RunService.Heartbeat.Connect(deltaTime => this.update(deltaTime)));

			{
				const e = new Instance("RemoteEvent");

				e.Parent = this.rig.getValue();
				e.OnServerEvent.Connect(() => this.getHumanoid().Health = 0);
			}
		}

		this.applyUnit();
		
		this.collector.add(SpawnManager.onNetworkBehaviorDestroying.connect(behavior => {
			if (behavior === this.lastUnit) this.lastUnit = undefined;
		}));

		this.unit.onValueChanged.connect(() => this.applyUnit());
	}

	public willRemove(): void {
		this.collector.teardown();
		this.applyUnit(undefined);

		this.lastUnit = undefined;
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	//////////////////////////////
	// INITIALIZATION
	//////////////////////////////
	@ServerSideOnly
	private initializeCollider() {
		const collider = new Instance("Part");

		collider.Parent = this.rig.getValue();
		collider.Size = CharacterPhysics.CHARACTER_COLLIDER_SIZE;
		collider.Massless = true;
		collider.CollisionGroup = CharacterPhysics.PHYSICS_GROUP_CHARACTER_COLLIDER;
		collider.Transparency = 1;
		collider.Shape = Enum.PartType.Ball;

		const rigidAttachment = new Instance("Attachment");

		rigidAttachment.CFrame = new CFrame(CharacterPhysics.CHARACTER_COLLIDER_OFFSET).mul(CFrame.fromEulerAnglesXYZ(0, math.pi / 2, math.pi / 2));
		rigidAttachment.Parent = collider;

		const rigid = new Instance("RigidConstraint");

		rigid.Attachment0 = rigidAttachment;
		rigid.Attachment1 = (collider.Parent as Model & { HumanoidRootPart: BasePart & { RootAttachment: Attachment } }).HumanoidRootPart.RootAttachment;

		rigid.Parent = collider;
	}

	@ServerSideOnly
	private initializeRig() {
		// Add prefab
		const rig = this.getGameObject().addInstancePrefabFromPath<Rig>(PathToRig);

		rig.ModelStreamingMode = Enum.ModelStreamingMode.Atomic;

		rig.GetDescendants().forEach(child => {
			if (child.IsA("BasePart")) child.CollisionGroup = CharacterPhysics.PHYSICS_GROUP_CHARACTER;
		});

		this.rig.setValue(rig);

		// Set Humanoid properties
		const humanoid = this.getHumanoid();

		humanoid.SetStateEnabled(Enum.HumanoidStateType.FallingDown, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.Flying, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.PlatformStanding, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.StrafingNoPhysics, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.RunningNoPhysics, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.Ragdoll, false);

		// Setup callbacks
		this.collector.add(humanoid.Died.Connect(() => this.onDied()));

		// Initialize other
		this.initializeCollider();
	}

	//////////////////////////////
	// CALLBACKS
	//////////////////////////////
	private update(deltaTime: number) {
		const humanoid = this.getHumanoid();
		const target = this.assignedTarget.getValue();
		const targetRig = target && target.rig.getValue();
		const targetPos = targetRig && targetRig.GetPivot().Position;

		if (target && (
			targetPos.sub(this.pathfindingAgent.currentGoalPoint).Magnitude > Pathfinding.MIN_DISTANCE_FROM_GOAL_FOR_RECALCULATION ||
			targetPos.sub(this.rig.getValue().GetPivot().Position).Magnitude > Pathfinding.MIN_DISTANCE_FROM_GOAL_FOR_PATHFINDING)) {
			this.pathfindingAgent.findPath(targetPos);
		}

		if (this.pathfindingAgent.isPathfinding) {
			const difference = this.pathfindingAgent.currentTargetPoint.sub(humanoid.RootPart!.Position);
			const distance = difference.Magnitude;
			const direction = difference.Unit;
			const horizontalDelta = new Vector3(this.pathfindingAgent.currentTargetPoint.X - humanoid.RootPart!.Position.X, 0, this.pathfindingAgent.currentTargetPoint.Z - humanoid.RootPart!.Position.Z);

			if (distance < Pathfinding.MINIMUM_DISTANCE_FOR_SEEK) {
				humanoid.MoveTo(this.pathfindingAgent.currentTargetPoint);
			} else {
				humanoid.Move(direction);
			}

			if (horizontalDelta.Magnitude < Pathfinding.MINIMUM_TARGET_REACHED_DISTANCE) this.pathfindingAgent.reachedTarget.fire();
		} else if (this.assignedTarget.getValue()) {
			humanoid.MoveTo(targetPos);
		} else if (this.currentOrder instanceof GuardOrder && this.assignedGuardNode) {
			humanoid.MoveTo(this.assignedGuardNode);
		} else {
			humanoid.Move(Vector3.zero);
		}

		if (this.shouldScanForTargets()) this.scanForTargets();
		if (this.shouldTryGetNewTarget() && this.unit.getValue().knownTargets.getValue().size() > 0) {
			const target = this.unit.getValue().requestTarget();

			if (target) this.assignedTarget.setValue(target);
		}

		if (!this.isCommander() && this.shouldMaintainFormation()) {
			const unit = this.unit.getValue();
			const index = unit.directMembers.indexOf(this);

			const commanderOrigin = unit.commander.getValue().rig.getValue().GetPivot();

			const final = Formations.FormationComputers[unit.formation.getValue()](index);

			humanoid.MoveTo(commanderOrigin.mul(new CFrame(final.X * 8, 0, final.Y * 8)).Position);
		}
	}

	private onDied() {
		this.died.fire();
		this.unit.setValue(undefined as unknown as Unit<any, any>);

		if (!Utilities.wasDestroyed(this)) this.getGameObject().destroy();
	}

	public onOrderExecuted(order: BaseOrder<any, any>) {
		this.currentOrder = order;

		if (order instanceof MoveOrder && this.isCommander()) {
			this.pathfindingAgent.findPath(order.executionParameters.getValue().position);
		} else if (order instanceof GuardOrder) {
			this.findGuardNode();
		}
	}

	private applyUnit(unit = this.unit.getValue()) {
		if (unit !== this.lastUnit) {
			this.lastUnit?.memberOnRemoving(this);
			unit?.memberOnAdded(this);

			this.lastUnit = unit;
		}
	}

	//////////////////////////////
	// AI BEHAVIORS
	//////////////////////////////
	/**
	 * TODO: needs a REAL implementation
	 */
	public scanForTargets() {
		SpawnManager.spawnedNetworkBehaviors.forEach(behavior => {
			if (behavior instanceof Character) {
				const otherUnit = behavior.unit.getValue() as CommandUnit | BattleUnit;
				const thisUnit = this.unit.getValue() as CommandUnit | BattleUnit;

				if (!otherUnit) warn(`No unit found for other ${behavior.getId()}`);
				if (!thisUnit) warn(`No unit found for this ${this.getId()}`);

				if (otherUnit && thisUnit && otherUnit.getFaction() !== thisUnit.getFaction()) {
					if (behavior.rig.getValue().GetPivot().Position.sub(this.rig.getValue().GetPivot().Position).Magnitude < 100)
						this.unit.getValue().tryReportTarget(behavior);
				}
			}
		});
	}

	public findGuardNode() {
		const nodes = CollectionService.GetTagged("GuardNode") as BasePart[];
		const pos = nodes[math.random(0, nodes.size() - 1)].Position;

		this.assignedGuardNode = pos;

		this.pathfindingAgent.findPath(pos).catch(e => {
			warn(`Failed to pathfind to ${pos}, error: ${e}`);

			this.findGuardNode();
		});
	}

	//////////////////////////////
	// GETTERS
	//////////////////////////////
	/**
	 * Returns whether or not this Character is the commander of its units
	 */
	public isCommander(): boolean {
		const unit = this.unit.getValue();

		return unit && unit.commander.getValue() === this;
	}

	public getHumanoid(): Humanoid {
		return this.rig.getValue().FindFirstChild("Humanoid") as Humanoid;
	}

	public hasRig(): boolean {
		return this.rig.getValue() !== undefined;
	}

	//////////////////////////////
	// PREDICATES
	//////////////////////////////
	public shouldMaintainFormation(): boolean {
		return !(this.currentOrder instanceof GuardOrder);
	}

	/**
	 * TODO: needs a REAL implementation
	 */
	public shouldScanForTargets(): boolean {
		return math.random() < 0.1;
	}

	public shouldTryGetNewTarget(): boolean {
		return this.assignedTarget.getValue() === undefined;
	}
}