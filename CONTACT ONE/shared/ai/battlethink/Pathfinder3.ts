import { Logging, LogGroup } from "CORP/shared/Libraries/Logging";
import { Signal } from "CORP/shared/Libraries/Signal";
import { CharacterPathfinding } from "../pathfinding/Pathfinding3";

function calculateHorizontalDistance(vector1: Vector3, vector2: Vector3) {
	return math.sqrt((vector1.X - vector2.X) ** 2 + (vector1.Z - vector2.Z) ** 2);
}

const PathfinderLogGroup = {
	enabled: true,
	prefix: "PATHFINDER"
} satisfies LogGroup;

export enum GoalType {
	/**
	 * Pathfind to the goal
	 */
	PATHFIND_TO,
	/**
	 * Walk directly to the goal
	 */
	WALK_TO,
	/**
	 * Equivalent to Humanoid:Move(goal)
	 */
	MOVE
}

export interface Goal {
	type: GoalType,
	position: Vector3,
	recalculationThreshold?: number,
	minTargetReachedDistance?: number
}

const RECALCULATION_ENABLED = true;

const MIN_DISTANCE_COVERED_SINCE_LAST_CHECK_FOR_PATH_RECALCULATION = 0;
const DISTANCE_COVERED_CHECK_INTERVAL = 1;

const WAYPOINT_APPLICATION_INTERVAL = 6;
const HUMANOID_MOVE_THRESHOLD = 2;

/**
 * todo: add blocked waypoint handling
 */
export class CharacterPathfinder {
	private readonly agent: CharacterPathfinding.Agent;
	private lastWaypoint: PathWaypoint | undefined;
	private goal: Goal | undefined;
	private lastGoal: Goal | undefined;
	private lastPosition = Vector3.zero;
	private lastDistanceCheck = 0;
	private lastWaypointAppliedTime = 0;

	// Current state
	private currentWaypoint: PathWaypoint | undefined;

	public readonly goalCompleted = new Signal<[Goal]>(`goalCompleted`);

	constructor(
		private readonly humanoid: Humanoid,
	) {
		this.agent = new CharacterPathfinding.Agent(humanoid);
	}

	update() {
		debug.profilebegin("Pathfinder update");

		if (!this.goal) {
			this.humanoid.Move(Vector3.zero);

			return;
		}

		if (tick() - this.lastWaypointAppliedTime > WAYPOINT_APPLICATION_INTERVAL) this.applyCurrentWaypoint();

		const goal = this.goal.position;
		const humanoidPosition = this.agent.getDefaultOrigin();

		const currentPath = this.agent.getCurrentPath();
		const distanceFromLastWaypointToTarget = currentPath && calculateHorizontalDistance(currentPath.waypoints[currentPath.waypoints.size() - 1].Position, goal);
		const distanceFromGoal = calculateHorizontalDistance(humanoidPosition, goal);

		const didGoalChange = this.goal !== this.lastGoal;

		if (didGoalChange) this.lastGoal = this.goal;

		const shouldCheckMovement = tick() - this.lastDistanceCheck > DISTANCE_COVERED_CHECK_INTERVAL;
		const hasNotMovedEnough = shouldCheckMovement && !this.agent.isComputing() && currentPath !== undefined && humanoidPosition.sub(this.lastPosition).Magnitude < MIN_DISTANCE_COVERED_SINCE_LAST_CHECK_FOR_PATH_RECALCULATION;

		if (hasNotMovedEnough) Logging.warn(PathfinderLogGroup, "Hasn't moved enough recently, recalculating");

		if (shouldCheckMovement) {
			this.lastDistanceCheck = tick();
			this.lastPosition = humanoidPosition;
		}

		switch (this.goal.type) {
			case GoalType.PATHFIND_TO:
				if (this.agent.isComputing()) {
					const currentWaypoint = this.agent.getCurrentWaypoint();
					if (currentWaypoint) {
						const distanceToCurrentWaypoint = calculateHorizontalDistance(humanoidPosition, currentWaypoint.Position);
						if (distanceToCurrentWaypoint < (this.goal.minTargetReachedDistance ?? CharacterPathfinding.MINIMUM_TARGET_REACHED_DISTANCE)) {
							this.humanoid.Move(Vector3.zero);
							return;
						}
					}
				} else {
					const shouldCreatePath = hasNotMovedEnough || (currentPath === undefined && (didGoalChange || distanceFromGoal > CharacterPathfinding.MIN_DISTANCE_FROM_GOAL_FOR_PATHFINDING));
					const shouldRecalculatePath = (RECALCULATION_ENABLED && currentPath !== undefined && !shouldCreatePath) && (didGoalChange || distanceFromLastWaypointToTarget! > (this.goal.recalculationThreshold ?? CharacterPathfinding.MIN_DISTANCE_FROM_GOAL_FOR_RECALCULATION));

					if (shouldCreatePath || shouldRecalculatePath) {
						const prom = shouldCreatePath ?
							this.agent.createPath(goal) :
							this.agent.appendPath(goal, this.agent.getCurrentPath()!).then(([output]) => output);

						prom.then(output => new Promise((resolve, reject) => {
							if (output.status === Enum.PathStatus.Success) {
								this.agent.setCurrentPath(output.path);
							} else {
								reject(output.status);
							}
						})).then(undefined, reason => Logging.warn(PathfinderLogGroup, `Failed to pathfind: ${tostring(reason)}`));
					} else if (this.agent.getCurrentPath() !== undefined) {
						debug.profilebegin("Pathfinder apply movement");

						const currentWaypoint = this.agent.getCurrentWaypoint()!;
						const distanceToCurrentWaypoint = calculateHorizontalDistance(humanoidPosition, currentWaypoint.Position);

						if (distanceToCurrentWaypoint < HUMANOID_MOVE_THRESHOLD)
							this.humanoid.Move(currentWaypoint.Position.sub(humanoidPosition));

						this.checkForWaypointChange(currentWaypoint);

						if (distanceToCurrentWaypoint < (this.goal.minTargetReachedDistance ?? CharacterPathfinding.MINIMUM_TARGET_REACHED_DISTANCE)) this.agent.onWaypointReached();
						if (this.agent.isFinished()) {
							this.goalCompleted.fire(this.goal);
							this.agent.setCurrentPath(undefined);
						}

						debug.profileend();
					}
				}

				break;
			case GoalType.WALK_TO:
			case GoalType.MOVE:
				this.humanoid.Move(goal);
		}

		if (!this.agent.getCurrentPath()) this.humanoid.Move(Vector3.zero);

		debug.profileend();
	}

	private checkForWaypointChange(newWaypoint: PathWaypoint | undefined) {
		if (newWaypoint !== this.lastWaypoint) {
			this.setCurrentWaypoint(newWaypoint);

			this.lastWaypoint = newWaypoint;
		}
	}

	private setCurrentWaypoint(waypoint: PathWaypoint | undefined) {
		this.currentWaypoint = waypoint;

		this.applyCurrentWaypoint();
	}

	private applyCurrentWaypoint() {
		if (this.currentWaypoint) this.humanoid.MoveTo(this.currentWaypoint.Position);

		this.lastWaypointAppliedTime = tick();
	}

	public teardown() {
		this.agent.teardown();
	}

	public setCurrentGoal(goal?: Goal) {
		this.goal = goal;
	}
}