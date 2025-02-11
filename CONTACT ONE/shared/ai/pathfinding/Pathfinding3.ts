/* eslint-disable @typescript-eslint/no-explicit-any */
import Object from "@rbxts/object-utils";
import { PathfindingService, Workspace } from "@rbxts/services";
import { Signal } from "CORP/shared/Libraries/Signal";

export const PATHFINDING_DEFAULT_PARAMETERS = {
	AgentCanClimb: true,
	AgentCanJump: false,
	AgentHeight: 5,
	AgentRadius: 3,
	WaypointSpacing: math.huge
} as AgentParameters;

class Visualization {
	private debugParts = new Map<number, [Part, Attachment, Beam | undefined]>();
	private index: number = 0;

	public setWaypoints(waypoints: Vector3[]) {
		this.debugParts.forEach(([part]) => part.Destroy());
		this.debugParts.clear();

		const parts: [Part, Attachment, Beam | undefined][] = [];

		waypoints.forEach((waypoint, index) => {
			const part = new Instance("Part");

			part.CanCollide = false;
			part.Anchored = true;
			part.CastShadow = false;
			part.Color = new Color3(1, 1, 1);
			part.Shape = Enum.PartType.Ball;
			part.Parent = Workspace;
			part.Name = `Waypoint${index}`;
			part.Material = Enum.Material.Neon;
			part.Position = waypoint;

			const attachment = new Instance("Attachment");

			attachment.Parent = part;

			let beam;

			if (index > 0) {
				beam = new Instance("Beam");

				beam.Parent = Workspace.Terrain;
				beam.Color = new ColorSequence(new Color3(1, 1, 1));
				beam.FaceCamera = true;
				beam.Attachment0 = parts[index - 1][1];
				beam.Attachment1 = attachment;
			}

			parts[index] = [part, attachment, beam];
		});

		this.debugParts = new Map(parts.map((part, index) => [index, part]));

		this.updateWaypoints();
	}

	public updateWaypoints() {
		this.debugParts.forEach(([part, , beam], index) => {
			let color = new Color3(1, 1, 1);

			if (index < this.index) {
				color = Color3.fromRGB(85, 255, 85);
			} else if (index === this.index) {
				color = Color3.fromRGB(0, 85, 255);
			} else if (index > this.index) {
				color = Color3.fromRGB(255, 85, 85);
			}

			if (beam) beam.Color = new ColorSequence(color);
			part.Color = color;
		});
	}

	public setIndex(index: number) {
		this.index = index;

		this.updateWaypoints();
	}
}

export namespace Pathfinding3 {
	export interface AgentPath {
		waypoints: PathWaypoint[]
	}

	export interface PathComputationOutput {
		status: Enum.PathStatus,
		path: AgentPath
	}

	export class Agent {
		private readonly path: Path = PathfindingService.CreatePath(PATHFINDING_DEFAULT_PARAMETERS);
		private readonly humanoid: Humanoid;
		private currentPath: AgentPath | undefined;
		private computationPromise: Promise<any> | undefined;

		public readonly finished = new Signal<[AgentPath]>(`finished`);
		public waypointIndex: number = 0;

		private visualizer = new Visualization();

		constructor(humanoid: Humanoid) {
			this.humanoid = humanoid;
		}

		public getDefaultOrigin(): Vector3 {
			return this.humanoid.RootPart!.Position;
		}

		private static createFailedComputation(status: Enum.PathStatus): PathComputationOutput {
			return {
				path: this.createAgentPath([]),
				status: status
			};
		}

		private static createSuccessfulComputation(waypoints: PathWaypoint[]): PathComputationOutput {
			return {
				path: this.createAgentPath(waypoints),
				status: Enum.PathStatus.Success
			};
		}

		private static wrapComputation(promise: Promise<PathWaypoint[]>): Promise<PathComputationOutput> {
			return promise.then(waypoints => this.createSuccessfulComputation(waypoints), status => this.createFailedComputation(status));
		}

		private static createAgentPath(waypoints: PathWaypoint[]): AgentPath {
			return { waypoints };
		}

		/**
		 * Creates a new path asynchronously.
		 * 
		 * @param origin Override origin, or current humanoid origin.
		 */
		public async createPath(
			goal: Vector3,
			origin: Vector3 = this.getDefaultOrigin()
		): Promise<PathComputationOutput> {
			return await Agent.wrapComputation(this.computePath(goal, origin));
		}

		private checkIfFinished() {
			if (this.isFinished()) this.finished.fire(this.currentPath!);
		}

		/**
		 * Callback for when a waypoint is reached by the host of the agent.
		 */
		public onWaypointReached() {
			this.waypointIndex++;

			this.visualizer.setIndex(this.waypointIndex);

			this.checkIfFinished();
		}

		/**
		 * Recalculate the current waypoint based on which 
		 */
		public getCurrentWaypoint(): PathWaypoint | undefined {
			return this.currentPath?.waypoints[this.waypointIndex];
		}

		public setCurrentPath(path?: AgentPath, overrideIndex: number = 1) {
			if (path?.waypoints.size() === 0) {
				warn("Path has 0 waypoints, interpreting input as setCurrentPath(undefined)");

				this.currentPath = undefined;
			}

			this.currentPath = path;
			this.waypointIndex = overrideIndex;

			this.visualizer.setWaypoints(this.currentPath?.waypoints.map(wp => wp.Position) ?? []);
			this.visualizer.setIndex(overrideIndex);
		}

		public isFinished() {
			return this.currentPath && this.waypointIndex === this.currentPath.waypoints.size();
		}

		public async appendPath(goal: Vector3, existingPath: AgentPath): Promise<[PathComputationOutput, number]> {
			const origin = this.getDefaultOrigin();
			const newStartIndex = findBestRecalculationNode(origin, existingPath.waypoints.map(wp => wp.Position), goal);

			if (newStartIndex === undefined) {
				return [await Agent.wrapComputation(this.computePath(goal, origin)), 1];
			}

			const existingWaypoints = existingPath.waypoints.filter((_, i) => i < newStartIndex && i >= this.waypointIndex);

			try {
				const waypoints = await this.computePath(goal, existingWaypoints[existingWaypoints.size() - 1]?.Position ?? origin);

				return [Agent.createSuccessfulComputation([...existingWaypoints, ...waypoints]), newStartIndex];
			} catch (status: any) {
				return [Agent.createFailedComputation(status as Enum.PathStatus), newStartIndex];
			}
		}

		private computeWithTempPath(goal: Vector3, origin: Vector3, override: AgentParameters): Promise<PathWaypoint[]> {
			const path = PathfindingService.CreatePath(Object.assign(table.clone(PATHFINDING_DEFAULT_PARAMETERS), override));

			const output = this.computePath(goal, origin, path);

			path.Destroy();
			
			return output;
		}

		private computePath(goal: Vector3, origin: Vector3, path = this.path): Promise<PathWaypoint[]> {
			this.computationPromise = this.compute(goal, origin, path);

			this.computationPromise.then(() => this.computationPromise = undefined, () => this.computationPromise = undefined);

			return this.computationPromise;
		}

		/**
		 * @deprecated
		 */
		private async compute(goal: Vector3, origin: Vector3, path = this.path): Promise<PathWaypoint[]> {
			return new Promise((resolve, reject) => {
				try {
					path.ComputeAsync(origin, goal);

					// Check status after computation is complete
					if (path.Status !== Enum.PathStatus.Success) {
						reject(path.Status);
					} else {
						resolve(this.path.GetWaypoints());
					}
				} catch (e) {
					reject(e);
				}
			});
		}

		public getCurrentPath() {
			return this.currentPath;
		}

		public isComputing() {
			return this.computationPromise !== undefined;
		}

		private onWaypointBlocked(index: number) {
			
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