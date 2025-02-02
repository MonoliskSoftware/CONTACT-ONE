import { PathfindingService } from "@rbxts/services";
import { Connection, Signal } from "CORP/shared/Libraries/Signal";
import { dict } from "CORP/shared/Libraries/Utilities";

export namespace Pathfinding {
	export const MINIMUM_TARGET_REACHED_DISTANCE = 1;
	/**
	 * Minimum distance from next waypoint to use the seek algorithm.
	 */
	export const MINIMUM_DISTANCE_FOR_SEEK = 0.5;

	export const MIN_DISTANCE_FROM_GOAL_FOR_RECALCULATION = 10;
	export const MIN_DISTANCE_FROM_GOAL_FOR_PATHFINDING = 20;

	export class Trip {
		public readonly goal: Vector3;
		public readonly agent: Agent;

		/**
		 * Cache of the origin for the latest calculation of the path.
		 */
		public origin: Vector3 = Vector3.zero;
		public nextWaypointIndex: number = 0;
		public waypoints: PathWaypoint[] = [];
		public finished = false;

		constructor(goal: Vector3, agent: Agent) {
			this.goal = goal;
			this.agent = agent;

			this.recalculate();
		}

		recalculate() {
			this.origin = this.agent.getOrigin();

			this.agent.path.ComputeAsync(this.origin, this.goal);

			if (this.agent.path.Status !== Enum.PathStatus.Success) throw `Got a bad status while pathfinding to ${this.goal}: ${this.agent.path.Status}`;

			this.waypoints = this.agent.path.GetWaypoints();
			this.nextWaypointIndex = 1;

			if (this.waypoints.size() === 0) warn(`Pathfinding returned 0 waypoints`);

			// Initially move to second waypoint (first waypoint is path start; skip it)
			this.agent.currentWaypoint = this.waypoints[this.nextWaypointIndex];
		}

		dispose() {
			(this as dict).agent = undefined;
		}
	}

	export class Agent {
		public readonly path: Path;
		public readonly humanoid: Humanoid;
		public currentTrip: Trip | undefined;
		private readonly blockedConnection: RBXScriptConnection;
		private readonly reachedConnection: Connection<[]>;
		public isPathing = false;
		/**
		 * Used by Character to indicate when a waypoint was reached.
		 */
		public readonly reachedWaypoint = new Signal<[]>(`agentReachedWaypoint`);

		public currentWaypoint: PathWaypoint | undefined;

		constructor(humanoid: Humanoid) {
			this.path = PathfindingService.CreatePath({
				AgentCanClimb: true,
				AgentCanJump: true,
				AgentHeight: 5,
				AgentRadius: 2,
			});

			this.humanoid = humanoid;

			this.blockedConnection = this.path.Blocked.Connect(index => {
				// Check if the obstacle is further down the path
				if (this.currentTrip && this.currentTrip.nextWaypointIndex !== undefined && index >= this.currentTrip.nextWaypointIndex) {
					// Stop detecting path blockage until path is re-computed
					this.blockedConnection?.Disconnect();

					warn("Recomputing...");
					// Call function to re-compute new path
					this.currentTrip?.recalculate();
				}
			});

			this.reachedConnection = this.reachedWaypoint.Connect(() => {
				if (this.currentTrip && this.currentTrip.nextWaypointIndex < this.currentTrip.waypoints.size() - 1) {
					// Increase waypoint index and move to next waypoint
					this.currentTrip.nextWaypointIndex++;

					this.currentWaypoint = this.currentTrip.waypoints[this.currentTrip.nextWaypointIndex];
				} else {
					if (this.currentTrip) this.currentTrip.finished = true;

					this.isPathing = false;
					this.currentWaypoint = undefined;
				}
			});
		}

		public getOrigin(): Vector3 {
			return this.humanoid.RootPart?.Position ?? Vector3.zero;
		}

		public createTrip(goal: Vector3) {
			return new Trip(goal, this);
		}

		public setCurrentTrip(trip: Trip | undefined) {
			this.isPathing = trip !== undefined && trip.nextWaypointIndex < trip.waypoints.size() - 1;

			this.currentTrip = trip;

			if (trip) {
				this.currentWaypoint = trip.waypoints[trip.nextWaypointIndex];
			}
		}
	}
}