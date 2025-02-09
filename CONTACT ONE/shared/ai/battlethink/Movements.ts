import { Workspace } from "@rbxts/services";
import { Pathfinding } from "../pathfinding/Pathfinding";
import { AIBattleController } from "./AIBattleController";

function createDebugPart(position: Vector3, connectedPart: Attachment, color = new Color3(1, 1, 1)) {
	const part = new Instance("Part");

	part.Parent = Workspace;
	part.Size = Vector3.one.mul(3);
	part.Anchored = true;
	part.CanCollide = false;
	part.CanQuery = false;
	part.CanTouch = false;
	part.Color = color;
	part.Position = position;

	const attach = new Instance("Attachment");

	attach.Parent = part;

	const beam = new Instance("Beam");

	beam.Parent = Workspace.Terrain;
	beam.FaceCamera = true;
	beam.Attachment0 = connectedPart;
	beam.Attachment1 = attach;
	beam.Color = new ColorSequence(color);

	return [part, beam] as [Part, Beam];
}

export abstract class Movement {
	/**
	 * Whether the behavior is enabled, or should be ignored and have lower-priority behaviors acted upon instead.
	 */
	public enabled = true;

	protected readonly controller: AIBattleController;
	protected readonly humanoid: Humanoid;

	public readonly name: string;

	constructor(controller: AIBattleController, name: string) {
		this.controller = controller;
		this.humanoid = this.controller.character.getValue().getHumanoid();
		this.name = name;
	}

	abstract update(deltaTime: number): void;
	abstract onActivatedChanged(activated: boolean): void;
	abstract willDispose(): void;

	public dispose() {
		this.willDispose();

		this.controller.removeMovement(this);
	}
}

export class TripMovement extends Movement {
	public readonly trip: Pathfinding.AgentPath;
	private readonly agent: Pathfinding.Agent;

	protected goalPart: [Part, Beam];
	protected waypointPart: [Part, Beam];
	protected originPart: [Part, Beam];

	constructor(controller: AIBattleController, name: string, trip: Pathfinding.AgentPath) {
		super(controller, name);

		this.trip = trip;
		this.agent = trip.agent;

		this.goalPart = createDebugPart(Vector3.zero, (this.humanoid.RootPart as unknown as { RootAttachment: Attachment }).RootAttachment, new Color3(1, 0, 0));
		this.waypointPart = createDebugPart(Vector3.zero, (this.humanoid.RootPart as unknown as { RootAttachment: Attachment }).RootAttachment, new Color3(0, 1, 0));
		this.originPart = createDebugPart(Vector3.zero, (this.humanoid.RootPart as unknown as { RootAttachment: Attachment }).RootAttachment, new Color3(0, 0, 1));
	}

	update(deltaTime: number): void {
		if (this.agent.currentTrip !== this.trip) this.agent.setCurrentTrip(this.trip);

		if (!this.trip.finished) {
			if (!this.agent.currentWaypoint) {
				warn(`Agent is pathfinding, but no current waypoint is assigned.`);

				this.enabled = false;
			} else {
				const currentWaypointPosition = this.agent.currentWaypoint.Position;
				const npcPosition = this.humanoid.RootPart!.Position;
				const horizontalDelta = new Vector3(currentWaypointPosition.X - this.humanoid.RootPart!.Position.X, 0, currentWaypointPosition.Z - this.humanoid.RootPart!.Position.Z);

				const shouldNotSeek = horizontalDelta.Magnitude < Pathfinding.MINIMUM_DISTANCE_FOR_SEEK;
				const hasReachedWaypoint = horizontalDelta.Magnitude < Pathfinding.MINIMUM_TARGET_REACHED_DISTANCE;

				if (shouldNotSeek || hasReachedWaypoint) {
					if (shouldNotSeek) this.humanoid.MoveTo(currentWaypointPosition);
					if (hasReachedWaypoint) this.agent.reachedWaypoint.fire();

					return;
				}

				// Compute desired velocity
				let desiredVelocity = currentWaypointPosition.sub(npcPosition);

				desiredVelocity = desiredVelocity.Unit.mul(this.humanoid.WalkSpeed);

				// Approximate current velocity using humanoid's MoveDirection
				const currentVelocity = this.humanoid.MoveDirection.mul(this.humanoid.WalkSpeed);

				// Compute steering force
				let steerVector = desiredVelocity.sub(currentVelocity);
				const MAX_STEER = 16;

				if (steerVector.Magnitude > MAX_STEER) {
					steerVector = steerVector.Unit.mul(MAX_STEER);
				}

				// Apply as acceleration instead of direct movement
				this.humanoid.Move(currentVelocity.add(steerVector).Unit);

				if (horizontalDelta.Magnitude < Pathfinding.MINIMUM_TARGET_REACHED_DISTANCE) this.agent.reachedWaypoint.fire();

				this.waypointPart[0].Position = currentWaypointPosition;
			}
		} else {
			this.enabled = false;
		}

		this.goalPart[0].Position = this.trip.goal;
		this.originPart[0].Position = this.trip.origin;
	}

	onActivatedChanged(activated: boolean): void {
		if (activated) {
			if (this.agent.currentTrip !== this.trip) this.agent.setCurrentTrip(this.trip);
		} else
			if (this.agent.currentTrip === this.trip) this.agent.setCurrentTrip(undefined);


		this.goalPart[0].Transparency = !activated ? 1 : 0;
		this.waypointPart[0].Transparency = !activated ? 1 : 0;
		this.originPart[0].Transparency = !activated ? 1 : 0;
		this.goalPart[1].Enabled = activated;
		this.waypointPart[1].Enabled = activated;
		this.originPart[1].Enabled = activated;
	}

	willDispose(): void {
		this.goalPart[0].Destroy();
		this.waypointPart[0].Destroy();
		this.originPart[0].Destroy();

		this.trip.dispose();
	}

	async waitToFinish(): Promise<void> {
		if (this.trip.finished) return;

		return new Promise(resolve => this.agent.didCompletePath.connect(path => {
			if (path === this.trip) resolve();
		}));
	}
}

export class WrappedTripMovement extends TripMovement {
	constructor(controller: AIBattleController, name: string, agent: Pathfinding.Agent, goal: Vector3) {
		const trip = agent.createTrip(goal);
		
		super(controller, name, trip);
	}
}

export class MoveToPositionMovement extends Movement {
	public target: Vector3;

	constructor(controller: AIBattleController, name: string, target: Vector3) {
		super(controller, name);

		this.target = target;
	}

	update(deltaTime: number): void {
		this.humanoid.MoveTo(this.target);
	}

	onActivatedChanged(activated: boolean): void {

	}

	willDispose(): void {

	}
}

export class MoveToPartMovement extends Movement {
	public target: BasePart;

	constructor(controller: AIBattleController, name: string, target: BasePart) {
		super(controller, name);

		this.target = target;
	}

	update(deltaTime: number): void {
		this.humanoid.MoveTo(this.target.Position, this.target);
	}

	onActivatedChanged(activated: boolean): void {

	}

	willDispose(): void {

	}
}

export class DefaultMovement extends Movement {
	update(deltaTime: number): void {
		this.humanoid.Move(Vector3.zero);
	}

	onActivatedChanged(activated: boolean): void {

	}

	willDispose(): void {

	}
}