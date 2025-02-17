import { Signal } from "CORP/shared/Libraries/Signal";
import { CharacterPathfinding } from "../pathfinding/Pathfinding3";

function calculateHorizontalDistance(vector1: Vector3, vector2: Vector3) {
	return math.sqrt((vector1.X - vector2.X) ** 2 + (vector1.Z - vector2.Z) ** 2);
}

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

const RECALCULATION_ENABLED = false;

/**
 * todo: add blocked waypoint handling
 */
export class CharacterPathfinder {
	private readonly agent: CharacterPathfinding.Agent;
	private lastWaypoint: PathWaypoint | undefined;
	private goal: Goal | undefined;

	public readonly goalCompleted = new Signal<[Goal]>(`goalCompleted`);

	constructor(
		private readonly humanoid: Humanoid,
	) {
		this.agent = new CharacterPathfinding.Agent(humanoid);
	}

	async update() {
		if (this.goal) {
			const goal = this.goal.position;
			const humanoidPosition = this.agent.getDefaultOrigin();

			const currentPath = this.agent.getCurrentPath();
			const distanceFromLastWaypointToTarget = currentPath && calculateHorizontalDistance(currentPath.waypoints[currentPath.waypoints.size() - 1].Position, goal);

			switch (this.goal.type) {
				case GoalType.PATHFIND_TO:
					if (!this.agent.isComputing()) {
						const shouldCreatePath = currentPath === undefined;
						const shouldRecalculatePath = RECALCULATION_ENABLED && !shouldCreatePath && currentPath !== undefined && distanceFromLastWaypointToTarget! > (this.goal.recalculationThreshold ?? CharacterPathfinding.MIN_DISTANCE_FROM_GOAL_FOR_RECALCULATION);

						if (shouldCreatePath || shouldRecalculatePath) {
							if (shouldCreatePath) {
								const pathOutput = this.agent.createPath(goal).expect();

								if (pathOutput.status !== Enum.PathStatus.Success) {
									warn(pathOutput.status);

									return;
								}

								this.agent.setCurrentPath(pathOutput.path);
							} else {
								const [pathOutput] = this.agent.appendPath(goal, this.agent.getCurrentPath()!).expect();

								if (pathOutput.status !== Enum.PathStatus.Success) {
									warn(pathOutput.status);

									return;
								}

								this.agent.setCurrentPath(pathOutput.path);
							}
						} else if (this.agent.getCurrentPath() !== undefined) {
							const currentWaypoint = this.agent.getCurrentWaypoint()!;
							const distanceToCurrentWaypoint = calculateHorizontalDistance(humanoidPosition, currentWaypoint.Position);

							this.humanoid.Move(currentWaypoint.Position.sub(humanoidPosition));

							this.checkForWaypointChange(currentWaypoint);

							if (distanceToCurrentWaypoint < (this.goal.minTargetReachedDistance ?? CharacterPathfinding.MINIMUM_TARGET_REACHED_DISTANCE)) this.agent.onWaypointReached();
							if (this.agent.isFinished()) {
								this.goalCompleted.fire(this.goal);

								this.agent.setCurrentPath(undefined);
							}
						}
					}

					break;
				case GoalType.WALK_TO:
				case GoalType.MOVE:
					this.humanoid.Move(goal);
			}
		} else {
			this.humanoid.Move(Vector3.zero);
		}
	}

	private checkForWaypointChange(newWaypoint: PathWaypoint | undefined) {
		if (newWaypoint !== this.lastWaypoint) {
			this.onWaypointChanged(newWaypoint);

			this.lastWaypoint = newWaypoint;
		}
	}

	private onWaypointChanged(waypoint: PathWaypoint | undefined) {
		
	}

	public teardown() {
		this.agent.teardown();
	}

	public setCurrentGoal(goal?: Goal) {
		this.goal = goal;
	}
}