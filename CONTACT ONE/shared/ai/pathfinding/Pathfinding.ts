import { PathfindingService, Workspace } from "@rbxts/services";
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

	export class AgentPath {
		public readonly goal: Vector3;
		public readonly agent: Agent;

		/**
		 * Cache of the origin for the latest calculation of the path.
		 */
		public origin: Vector3 = Vector3.zero;
		public nextWaypointIndex: number = 0;
		public waypoints: PathWaypoint[] = [];
		public finished = false;

		private debugPoints: Part[] = [];

		constructor(goal: Vector3, agent: Agent, origin: Vector3 = agent.getOrigin()) {
			this.goal = goal;
			this.agent = agent;
			this.recalculate(origin);
		}

		recalculate(origin = this.agent.getOrigin()) {
			this.debugPoints.forEach(p => p.Destroy());
			this.debugPoints.clear();

			this.origin = origin;

			this.agent.path.ComputeAsync(origin, this.goal);

			if (this.agent.path.Status !== Enum.PathStatus.Success) throw `Got a bad status while pathfinding to ${this.goal}: ${this.agent.path.Status}`;

			this.waypoints = this.agent.path.GetWaypoints();
			this.nextWaypointIndex = 1;

			this.waypoints.forEach(wp => {
				const p = new Instance("Part", Workspace);

				p.Size = Vector3.one.mul(3);
				p.Anchored = true;
				p.CanCollide = false;
				p.CanQuery = false;
				p.CanTouch = false;
				p.Shape = Enum.PartType.Ball;

				p.Position = wp.Position;

				this.debugPoints.push(p);
			});

			if (this.waypoints.size() === 0) warn(`Pathfinding returned 0 waypoints`);

			// Initially move to second waypoint (first waypoint is path start; skip it)
			this.agent.currentWaypoint = this.waypoints[this.nextWaypointIndex];
		}

		dispose() {
			this.debugPoints.forEach(p => p.Destroy());
			this.debugPoints.clear();
			
			(this as dict).agent = undefined;
		}
	}

	export class Agent {
		public readonly path: Path;
		public readonly humanoid: Humanoid;
		public currentTrip: AgentPath | undefined;
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
				AgentRadius: 4,
				WaypointSpacing: 128
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
			return new AgentPath(goal, this);
		}

		public setCurrentTrip(trip: AgentPath | undefined) {
			this.isPathing = trip !== undefined && trip.nextWaypointIndex < trip.waypoints.size() - 1;

			this.currentTrip = trip;

			if (trip) {
				this.currentWaypoint = trip.waypoints[trip.nextWaypointIndex];
			}
		}

		public recalculateTripForNewTarget(existingTrip: AgentPath) {
			const startIndex = findBestRecalculationNode(this.getOrigin(), existingTrip.waypoints.map(wp => wp.Position), existingTrip.goal);
			const startingWaypoints = [];

			if (startIndex !== undefined && startIndex > 0) {
				for (let i = 0; i < existingTrip.waypoints.size(); i++) {
					startingWaypoints.push(existingTrip.waypoints[i]);
				}
			}

			const start = startingWaypoints.size() > 0 ? startingWaypoints[startingWaypoints.size() - 1].Position : this.getOrigin();

			const newTrip = new AgentPath(existingTrip.goal, this, start);

			newTrip.waypoints = startingWaypoints.move(0, -1, 0, newTrip.waypoints);

			return newTrip;
		}
	}

	export function findBestRecalculationNode(
		npcPosition: Vector3,
		existingPath: Vector3[],
		newTarget: Vector3
	): number | undefined {
		if (existingPath.size() === 0) return undefined;

		let bestIndex = -1;
		let bestScore = math.huge;

		const w1 = 1.0; // Weight for NPC distance
		const w2 = 1.5; // Weight for target distance
		const w3 = 0.5; // Weight for path deviation

		for (let i = 0; i < existingPath.size(); i++) {
			const node = existingPath[i];
			const distToNPC = npcPosition.sub(node).Magnitude;
			const distToTarget = node.sub(newTarget).Magnitude;
			const pathDirection = node.sub(npcPosition).Unit;
			const targetDirection = newTarget.sub(node).Unit;
			const deviation = math.acos(math.max(-1, math.min(1, pathDirection.Dot(targetDirection))));

			const score = w1 * distToNPC + w2 * distToTarget + w3 * deviation;
			if (score < bestScore) {
				bestScore = score;
				bestIndex = i;
			}
		}

		return bestIndex === -1 ? undefined : bestIndex;
	}
}