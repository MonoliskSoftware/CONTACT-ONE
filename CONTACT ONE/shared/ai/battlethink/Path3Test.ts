import { Workspace } from "@rbxts/services";
import { Pathfinding } from "../pathfinding/Pathfinding";
import { Pathfinding3 } from "../pathfinding/Pathfinding3";

function calculateHorizontalDistance(vector1: Vector3, vector2: Vector3) {
	return math.sqrt((vector1.X - vector2.X) ** 2 + (vector1.Z - vector2.Z) ** 2);
}

export class Path3Test {
	private readonly agent: Pathfinding3.Agent;
	private lastWaypoint: PathWaypoint | undefined;
	private lastPosition: Vector3 = Vector3.zero;

	constructor(
		private readonly humanoid: Humanoid,

	) {
		this.agent = new Pathfinding3.Agent(humanoid);
		this.lastPosition = this.agent.getDefaultOrigin();
	}

	private horizontalDistance(v1: Vector3, v2: Vector3) {
		return new Vector3(v1.X - v2.X, 0, v1.Z - v2.Z).Magnitude;
	}

	async update(deltaTime: number) {
		const target = Workspace.FindFirstChild("Target") as BasePart;
		const goal = target.Position;
		const humanoidPosition = this.agent.getDefaultOrigin();

		const currentPath = this.agent.getCurrentPath();
		const distanceFromTarget = calculateHorizontalDistance(humanoidPosition, goal);
		const distanceFromLastWaypointToTarget = currentPath && calculateHorizontalDistance(currentPath.waypoints[currentPath.waypoints.size() - 1].Position, goal);

		print(humanoidPosition.sub(this.lastPosition).Magnitude / deltaTime);

		this.lastPosition = humanoidPosition;

		if (!this.agent.isComputing()) {
			const shouldCreatePath = currentPath === undefined && distanceFromTarget > Pathfinding.MIN_DISTANCE_FROM_GOAL_FOR_PATHFINDING;
			const shouldRecalculatePath = !shouldCreatePath && currentPath !== undefined && distanceFromLastWaypointToTarget! > Pathfinding.MIN_DISTANCE_FROM_GOAL_FOR_RECALCULATION;

			if (shouldCreatePath || shouldRecalculatePath) {
				if (shouldCreatePath) {
					const pathOutput = this.agent.createPath(goal).expect();

					warn("Generating");

					if (pathOutput.status !== Enum.PathStatus.Success) {
						warn(pathOutput.status);

						return;
					}

					this.agent.setCurrentPath(pathOutput.path);
				} else {
					const [pathOutput] = this.agent.appendPath(goal, this.agent.getCurrentPath()!).expect();

					warn("Recalculating");

					if (pathOutput.status !== Enum.PathStatus.Success) {
						warn(pathOutput.status);

						return;
					}

					this.agent.setCurrentPath(pathOutput.path);
				}
			} else if (this.agent.getCurrentPath() !== undefined) {
				const currentWaypoint = this.agent.getCurrentWaypoint()!;
				const distanceToCurrentWaypoint = this.horizontalDistance(humanoidPosition, currentWaypoint.Position);

				this.humanoid.MoveTo(currentWaypoint.Position);

				this.checkForWaypointChange(currentWaypoint);

				if (distanceToCurrentWaypoint < Pathfinding.MINIMUM_TARGET_REACHED_DISTANCE) this.agent.onWaypointReached();
				if (this.agent.isFinished()) this.agent.setCurrentPath(undefined);
			}
		}
	}

	private checkForWaypointChange(newWaypoint: PathWaypoint | undefined) {
		if (newWaypoint !== this.lastWaypoint) {
			this.onWaypointChanged(newWaypoint);

			this.lastWaypoint = newWaypoint;
		}
	}

	private onWaypointChanged(waypoint: PathWaypoint | undefined) {
		print(waypoint?.Label);
	}
}