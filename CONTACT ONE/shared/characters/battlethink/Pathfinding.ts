import { PathfindingService } from "@rbxts/services";
import { Connection, Signal } from "CORP/shared/Libraries/Signal";

export namespace Pathfinding {
	export const MINIMUM_TARGET_REACHED_DISTANCE = 2;
	/**
	 * Minimum distance from next waypoint to use the seek algorithm.
	 */
	export const MINIMUM_DISTANCE_FOR_SEEK = 0.5;

	export const MIN_DISTANCE_FROM_GOAL_FOR_RECALCULATION = 10;
	export const MIN_DISTANCE_FROM_GOAL_FOR_PATHFINDING = 20;

	export class Agent {
		private path: Path;
		private humanoid: Humanoid;
		private reachedConnection: Connection | undefined;
		private blockedConnection: RBXScriptConnection | undefined;

		public currentTargetPoint: Vector3 = Vector3.zero;
		public currentGoalPoint: Vector3 = Vector3.zero;
		public isPathfinding = false;
		public readonly reachedTarget = new Signal<[]>(`AgentReachedTarget`);

		constructor(humanoid: Humanoid) {
			this.path = PathfindingService.CreatePath({
				AgentCanClimb: true,
				AgentCanJump: true,
				AgentHeight: 5,
				AgentRadius: 2,
			});

			this.humanoid = humanoid;
		}

		public destroy() {

		}

		public async findPath(target: Vector3) {
			this.path.ComputeAsync(this.humanoid.RootPart!.Position, target);

			this.currentGoalPoint = target;

			if (this.path.Status !== Enum.PathStatus.Success) throw this.path.Status;

			this.isPathfinding = true;

			const waypoints = this.path.GetWaypoints();
			let nextWaypointIndex = 1;

			this.blockedConnection = this.path.Blocked.Connect((blockedWaypointIndex) => {
				warn("GOT BLOCKED");
				// Check if the obstacle is further down the path
				if (blockedWaypointIndex >= nextWaypointIndex) {
					// Stop detecting path blockage until path is re-computed
					this.blockedConnection?.Disconnect();

					warn("Recomputing...");
					// Call function to re-compute new path
					this.findPath(target);
				}
			});

			// Detect when movement to next waypoint is complete
			if (!this.reachedConnection)
				this.reachedConnection = this.reachedTarget.Connect(() => {
					if (/*reached && */nextWaypointIndex < waypoints.size() - 1) {
						// Increase waypoint index and move to next waypoint
						nextWaypointIndex++;

						// Use boat if waypoint label is "UseBoat"; otherwise move to next waypoint
						// if (waypoints[nextWaypointIndex].Label == "UseBoat") {
						// 	useBoat();
						// } else {
						this.currentTargetPoint = waypoints[nextWaypointIndex].Position;
						// this.humanoid.MoveTo(waypoints[nextWaypointIndex].Position);
						// }
					} else {
						this.isPathfinding = false;
						this.currentTargetPoint = Vector3.zero;

						this.reachedConnection?.Disconnect();
						this.reachedConnection = undefined;
						this.blockedConnection?.Disconnect();
						this.blockedConnection = undefined;
					}
				});

			if (waypoints.size() === 0) {
				warn(`Pathfinding returned 0 waypoints: ${this.humanoid.RootPart!.Position} to ${target}`);
			}

			// Initially move to second waypoint (first waypoint is path start; skip it)
			this.currentTargetPoint = waypoints[nextWaypointIndex].Position;
		}
	}
}