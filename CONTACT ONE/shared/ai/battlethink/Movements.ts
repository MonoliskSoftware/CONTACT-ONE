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

	return part;
}

export abstract class Movement {
	/**
	 * Whether the behavior is enabled, or should be ignored and have lower-priority behaviors acted upon instead.
	 */
	public enabled = true;

	protected readonly controller: AIBattleController;
	protected readonly humanoid: Humanoid;

	protected goalPart: Part;
	protected waypointPart: Part;
	protected originPart: Part;

	constructor(controller: AIBattleController) {
		this.controller = controller;
		this.humanoid = this.controller.character.getValue().getHumanoid();

		this.goalPart = createDebugPart(Vector3.zero, (this.humanoid.RootPart as unknown as { RootAttachment: Attachment }).RootAttachment, new Color3(1, 0, 0));
		this.waypointPart = createDebugPart(Vector3.zero, (this.humanoid.RootPart as unknown as { RootAttachment: Attachment }).RootAttachment, new Color3(0, 1, 0));
		this.originPart = createDebugPart(Vector3.zero, (this.humanoid.RootPart as unknown as { RootAttachment: Attachment }).RootAttachment, new Color3(0, 0, 1));
	}

	abstract update(deltaTime: number): void;
	abstract onActivatedChanged(activated: boolean): void;
}

export class TripMovement extends Movement {
	public readonly trip: Pathfinding.Trip;
	private readonly agent: Pathfinding.Agent;

	constructor(controller: AIBattleController, trip: Pathfinding.Trip) {
		super(controller);

		this.trip = trip;
		this.agent = trip.agent;
	}

	update(deltaTime: number): void {
		if (this.agent.currentTrip !== this.trip) this.agent.setCurrentTrip(this.trip);

		if (!this.trip.finished) {
			if (!this.agent.currentWaypoint) {
				warn(`Agent is pathfinding, but no current waypoint is assigned.`);
			} else {
				const currentWaypointPosition = this.agent.currentWaypoint.Position;
				const difference = currentWaypointPosition.sub(this.humanoid.RootPart!.Position);
				const distance = difference.Magnitude;
				const direction = difference.Unit;
				const horizontalDelta = new Vector3(currentWaypointPosition.X - this.humanoid.RootPart!.Position.X, 0, currentWaypointPosition.Z - this.humanoid.RootPart!.Position.Z);

				// if (distance < Pathfinding.MINIMUM_DISTANCE_FOR_SEEK) {
				// this.humanoid.MoveTo(currentWaypointPosition);
				// } else {
				this.humanoid.Move(direction);
				// }

				if (horizontalDelta.Magnitude < Pathfinding.MINIMUM_TARGET_REACHED_DISTANCE) this.agent.reachedWaypoint.fire();

				this.waypointPart.Position = currentWaypointPosition;
			}
		} else {
			this.enabled = false;
		}

		this.goalPart.Position = this.trip.goal;
		this.originPart.Position = this.trip.origin;
	}

	onActivatedChanged(activated: boolean): void {
		if (activated) {
			if (this.agent.currentTrip !== this.trip) this.agent.setCurrentTrip(this.trip);
		} else {
			if (this.agent.currentTrip === this.trip) this.agent.setCurrentTrip(undefined);
		}
	}
}

export class MoveToPositionMovement extends Movement {
	public target: Vector3;

	constructor(controller: AIBattleController, target: Vector3) {
		super(controller);

		this.target = target;
	}

	update(deltaTime: number): void {
		this.humanoid.MoveTo(this.target);
	}

	onActivatedChanged(activated: boolean): void {

	}
}

export class MoveToPartMovement extends Movement {
	public target: BasePart;

	constructor(controller: AIBattleController, target: BasePart) {
		super(controller);

		this.target = target;
	}

	update(deltaTime: number): void {
		this.humanoid.MoveTo(this.target.Position, this.target);
	}

	onActivatedChanged(activated: boolean): void {

	}
}

export class DefaultMovement extends Movement {
	update(deltaTime: number): void {
		this.humanoid.Move(Vector3.zero);
	}

	onActivatedChanged(activated: boolean): void {

	}
}