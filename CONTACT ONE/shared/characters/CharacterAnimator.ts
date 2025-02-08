import Object from "@rbxts/object-utils";
import { RunService } from "@rbxts/services";
import { FlagUtil } from "../players/local/FlagUtil";
import BaseAnimations, { AnimationData } from "./BaseAnimations";
import { Character } from "./Character";

const userNoUpdateOnLoop = FlagUtil.getUserFlag("UserNoUpdateOnLoop");
const userAnimateScaleRun = FlagUtil.getUserFlag("UserAnimateScaleRun");

enum HumanAnimationPose {
	STANDING,
	RUNNING,
	CLIMBING,
	JUMPING,
	GETTING_UP,
	FREEFALL,
	FALLING_DOWN,
	SEATED,
	PLATFORM_STANDING,
	DEAD,
	SWIMMING
}

type AnimationTableEntryCell = {
	anim?: Animation,
	weight: number
}

type AnimationTableEntry = {
	count: number,
	totalWeight: number,
	connections: RBXScriptConnection[],
	animations: AnimationTableEntryCell[]
}

type LocomotionMapEntry = {
	lv: Vector2,
	speed: number,
	track?: AnimationTrack
}

function createAnimationTableEntry(): AnimationTableEntry {
	return {
		count: 0,
		totalWeight: 0,
		connections: [],
		animations: []
	};
}

const SMALL_BUT_NOT_ZERO = 0.0001;

export default class CharacterAnimator {
	// Static fields/constants
	static readonly fallTransitionTime = 0.2;
	static readonly jumpAnimDuration = 0.2;
	static readonly humanoidHipHeight = 0.2;
	static readonly runBlendTime = 0.2;
	static readonly WALK_SPEED = 6.4;
	static readonly RUN_SPEED = 12.8;
	static readonly emoteNames: { [key: string]: boolean } = { wave: false, point: false, dance: true, dance2: true, dance3: true, laugh: false, cheer: false };

	// Instance fields
	pose = HumanAnimationPose.STANDING;

	humanoid: Humanoid = undefined as unknown as Humanoid;
	animator: Animator = undefined as unknown as Animator;
	animationSpeedDampeningObject?: NumberValue;

	jumpAnimTime = 0;
	currentAnimation = "";
	currentAnimationSpeed = 1;
	currentAnimationTrack?: AnimationTrack;
	currentAnimationInstance?: Animation;
	currentAnimationKeyframeHandler?: RBXScriptConnection;
	humanoidSpeed = 0;
	lastBlendTime = 0;
	animationTable = new Map<string, AnimationTableEntry>();
	strafingLocomotionMap = new Map<string, LocomotionMapEntry>();
	fallbackLocomotionMap = new Map<string, LocomotionMapEntry>();
	locomotionMap = new Map<string, LocomotionMapEntry>();
	animationsPreloadState = new Map<string, boolean>();

	maxVeloX = 0;
	minVeloX = 0;
	maxVeloY = 0;
	minVeloY = 0;

	cachedLocalDirection = Vector2.zero;
	cachedRunningSpeed = 0;
	currentlyPlayingEmote = false;

	lastTick = 0;

	animationNames = new Map<string, AnimationData>(Object.entries(BaseAnimations));

	connections: RBXScriptConnection[] = [];
	loopThread: thread = undefined as unknown as thread;

	public character: Character = undefined as unknown as Character;

	// Callbacks
	onDied() {
		this.pose = HumanAnimationPose.DEAD;
	}

	onRunning(speed: number) {
		const heightScale = userAnimateScaleRun ? this.getHeightScale() : 1;

		const movedDuringEmote = this.currentlyPlayingEmote && this.humanoid.MoveDirection === Vector3.zero;
		const speedThreshold = movedDuringEmote ? this.humanoid.WalkSpeed / heightScale : 0.75;

		this.humanoidSpeed = speed;

		if (speed > speedThreshold * heightScale) {
			this.playAnimation("walk", 0.2, this.humanoid);

			if (this.pose !== HumanAnimationPose.RUNNING) {
				this.pose = HumanAnimationPose.RUNNING;

				this.updateVelocity(0);
			}
		} else if (!CharacterAnimator.emoteNames[this.currentAnimation] && !this.currentlyPlayingEmote) {
			this.playAnimation("idle", 0.2, this.humanoid);

			this.pose = HumanAnimationPose.STANDING;
		}
	}

	onJumping(active: boolean) {
		this.playAnimation("jump", 0.1, this.humanoid);

		this.jumpAnimTime = CharacterAnimator.jumpAnimDuration;
		this.pose = HumanAnimationPose.JUMPING;
	}

	onClimbing(speed: number) {
		if (userAnimateScaleRun) {
			speed /= this.getHeightScale();
		}

		const scale = 5;

		this.playAnimation("climb", 0.1, this.humanoid);
		this.setAnimationSpeed(speed / scale);

		this.pose = HumanAnimationPose.CLIMBING;
	}

	onGettingUp(active: boolean) {
		this.pose = HumanAnimationPose.GETTING_UP;
	}

	onFreeFall(active: boolean) {
		if (this.jumpAnimTime <= 0) {
			this.playAnimation("fall", CharacterAnimator.fallTransitionTime, this.humanoid);
		}

		this.pose = HumanAnimationPose.FREEFALL;
	}

	onFallingDown(active: boolean) {
		this.pose = HumanAnimationPose.FALLING_DOWN;
	}

	onPlatformStanding(active: boolean) {
		this.pose = HumanAnimationPose.PLATFORM_STANDING;
	}

	onSwimming(speed: number) {
		if (userAnimateScaleRun) {
			speed /= this.getHeightScale();
		}

		if (speed > 1) {
			const scale = 10;

			this.playAnimation("swim", 0.4, this.humanoid);
			this.setAnimationSpeed(speed / scale);

			this.pose = HumanAnimationPose.SWIMMING;
		} else {
			this.playAnimation("swimidle", 0.4, this.humanoid);

			this.pose = HumanAnimationPose.SWIMMING;
		}
	}

	onSeated(active: boolean, currentSeatPart: Seat | VehicleSeat | undefined) {
		this.pose = HumanAnimationPose.SEATED;
	}

	constructor(character: Character) {
		this.character = character;

		if (RunService.IsClient()) return;

		this.humanoid = this.character.rig.getValue().WaitForChild("Humanoid") as Humanoid;
		this.animator = this.humanoid.WaitForChild("Animator") as Animator;
		this.animationSpeedDampeningObject = this.character.rig.getValue().FindFirstChild("ScaleDampeningPercent") as NumberValue;

		this.loopThread = task.spawn(() => {
			while (true) {
				task.wait(0.1);

				this.stepAnimate(tick());
			}
		});

		Object.entries(this.animationNames).forEach(([name, fileList]) => this.configureAnimationSet(name, fileList));

		script.GetChildren().forEach(child => {
			if (child.IsA("StringValue")) {
				this.animationNames.set(child.Name, []);
				// This \/\/ can be assumed because of this /\/\
				this.configureAnimationSet(child.Name, this.animationNames.get(child.Name) as []);
			}
		});

		this.connections.push(this.humanoid.Died.Connect((...args) => this.onDied(...args)));
		this.connections.push(this.humanoid.Running.Connect((...args) => this.onRunning(...args)));
		this.connections.push(this.humanoid.Jumping.Connect((...args) => this.onJumping(...args)));
		this.connections.push(this.humanoid.Climbing.Connect((...args) => this.onClimbing(...args)));
		this.connections.push(this.humanoid.GettingUp.Connect((...args) => this.onGettingUp(...args)));
		this.connections.push(this.humanoid.FreeFalling.Connect((...args) => this.onFreeFall(...args)));
		this.connections.push(this.humanoid.FallingDown.Connect((...args) => this.onFallingDown(...args)));
		this.connections.push(this.humanoid.PlatformStanding.Connect((...args) => this.onPlatformStanding(...args)));
		this.connections.push(this.humanoid.Swimming.Connect((...args) => this.onSwimming(...args)));
		this.connections.push(this.humanoid.Seated.Connect((...args) => this.onSeated(...args)));
	}

	teardown() {
		this.connections.forEach(connection => connection.Disconnect());
		this.connections.clear();

		this.animationTable.forEach(value => {
			value.connections.forEach(connection => connection.Disconnect());
			value.connections.clear();

			value.animations.forEach(animation => {
				animation.anim?.Destroy();
				animation.anim = undefined;
			});
			value.animations.clear();
		});
		this.animationTable.clear();

		this.stopAllAnimations();
		this.destroyWalkAnimations();

		this.animationNames.clear();

		this.strafingLocomotionMap.clear();
		this.fallbackLocomotionMap.clear();
		this.locomotionMap.clear();
		this.animationsPreloadState.clear();

		coroutine.close(this.loopThread);
	}

	stepAnimate(currentTime: number) {
		const deltaTime = currentTime - this.lastTick;

		this.lastTick = currentTime;

		if (this.jumpAnimTime > 0) {
			this.jumpAnimTime -= deltaTime;
		}

		if (this.pose === HumanAnimationPose.FREEFALL && this.jumpAnimTime <= 0) {
			this.playAnimation("fall", CharacterAnimator.fallTransitionTime, this.humanoid);
		} else if (this.pose === HumanAnimationPose.SEATED) {
			this.playAnimation("sit", 0.5, this.humanoid);

			return;
		} else if (this.pose === HumanAnimationPose.RUNNING) {
			this.playAnimation("walk", 0.2, this.humanoid);

			this.updateVelocity(currentTime);
		} else if (this.pose === HumanAnimationPose.DEAD || this.pose === HumanAnimationPose.GETTING_UP || this.pose === HumanAnimationPose.FALLING_DOWN || this.pose === HumanAnimationPose.PLATFORM_STANDING) {
			this.stopAllAnimations();
		}
	}

	stopAllAnimations() {
		let oldAnim = this.currentAnimation;

		// return to idle if finishing an emote
		if (CharacterAnimator.emoteNames[oldAnim] !== undefined && !CharacterAnimator.emoteNames[oldAnim]) {
			oldAnim = "idle";
		}

		if (this.currentlyPlayingEmote) {
			oldAnim = "idle";

			this.currentlyPlayingEmote = false;
		}

		this.currentAnimation = "";
		this.currentAnimationInstance = undefined;

		if (this.currentAnimationKeyframeHandler) {
			this.currentAnimationKeyframeHandler.Disconnect();
			this.currentAnimationKeyframeHandler = undefined;
		}

		if (this.currentAnimationTrack) {
			this.currentAnimationTrack.Stop();
			this.currentAnimationTrack.Destroy();
			this.currentAnimationTrack = undefined;
		}

		for (const [_, v] of pairs(this.locomotionMap)) {
			if (v.track) {
				v.track.Stop();
				v.track.Destroy();
				v.track = undefined;
			}
		}
	}

	getWalkDirection() {
		const walkToPoint = this.humanoid.WalkToPoint;
		const walkToPart = this.humanoid.WalkToPart;

		if (this.humanoid.MoveDirection !== Vector3.zero) {
			return this.humanoid.MoveDirection;
		} else if (walkToPart || walkToPoint !== Vector3.zAxis) {
			const destination = walkToPart ? walkToPart.CFrame.PointToWorldSpace(walkToPoint) : walkToPoint;
			let moveVector = Vector3.zero;

			if (this.humanoid.RootPart) {
				moveVector = destination.sub(this.humanoid.RootPart.CFrame.Position);
				moveVector = new Vector3(moveVector.X, 0, moveVector.Z);

				const mag = moveVector.Magnitude;

				if (mag > 0.01) {
					moveVector = moveVector.div(mag);
				}
			}

			return moveVector;
		} else {
			return this.humanoid.MoveDirection;
		}
	}

	updateVelocity(currentTime: number) {
		if (this.locomotionMap === this.strafingLocomotionMap) {
			const moveDirection = this.getWalkDirection();

			if (!this.humanoid.RootPart) return;

			const cframe = this.humanoid.RootPart.CFrame;

			if (math.abs(cframe.UpVector.Y) < SMALL_BUT_NOT_ZERO || this.pose !== HumanAnimationPose.RUNNING || this.humanoidSpeed < 0.001) {
				// We are horizontal! do something (turn off locomotion)
				for (const [n, v] of pairs(this.locomotionMap)) {
					v.track?.AdjustWeight(SMALL_BUT_NOT_ZERO, CharacterAnimator.runBlendTime);
				}

				return;
			}

			const lookat = cframe.LookVector;
			const direction = (new Vector3(lookat.X, 0, lookat.Z)).Unit;

			let ly = moveDirection.Dot(direction);

			if (ly <= 0 && ly > -0.05) {
				ly = SMALL_BUT_NOT_ZERO; // Break quadrant ties in favor of forward-friendly strafes
			}

			const lx = direction.X * moveDirection.Z - direction.Z * moveDirection.X;
			const tempDir = new Vector2(lx, ly);
			const delta = new Vector2(tempDir.X - this.cachedLocalDirection.X, tempDir.Y - this.cachedLocalDirection.Y);
			if (delta.Dot(delta) > 0.001 || math.abs(this.humanoidSpeed - this.cachedRunningSpeed) > 0.01 || currentTime - this.lastBlendTime > 1) {
				this.cachedLocalDirection = tempDir;
				this.cachedRunningSpeed = this.humanoidSpeed;

				this.lastBlendTime = currentTime;
				this.blend2D(this.cachedLocalDirection, this.cachedRunningSpeed);
			}
		} else if (math.abs(this.humanoidSpeed - this.cachedRunningSpeed) > 0.01 || currentTime - this.lastBlendTime > 1) {
			this.cachedRunningSpeed = this.humanoidSpeed;

			this.lastBlendTime = currentTime;

			this.blend2D(Vector2.yAxis, this.cachedRunningSpeed);
		}
	}

	signedAngle(a: Vector2, b: Vector2) {
		return -math.atan2(a.X * b.Y - a.Y * b.X, a.X * b.X + a.Y * b.Y);
	}

	get2DWeight(px: Vector2, p1: Vector2, p2: Vector2, sx: number, s1: number, s2: number) {
		const angleWeight = 2.0;
		const avgLength = 0.5 * (s1 + s2);

		const p_1 = new Vector2((sx - s1) / avgLength, (angleWeight * this.signedAngle(p1, px)));
		const p12 = new Vector2((s2 - s1) / avgLength, (angleWeight * this.signedAngle(p1, p2)));
		const denom = SMALL_BUT_NOT_ZERO + (p12.X * p12.X + p12.Y * p12.Y);
		const numer = p_1.X * p12.X + p_1.Y * p12.Y;
		const r = math.clamp(1.0 - numer / denom, 0.0, 1.0);

		return r;
	}

	blend2D(targetVelocity: Vector2, targetSpeed: number) {
		if (userAnimateScaleRun) {
			const heightScale = this.getHeightScale();

			targetVelocity = targetVelocity.div(heightScale);
			targetSpeed /= heightScale;
		}

		const h: Map<string, number> = new Map();
		let sum = 0;

		for (const [n, v1] of pairs(this.locomotionMap)) {
			if (targetVelocity.X * v1.lv.X < 0 || targetVelocity.Y * v1.lv.Y < 0) {
				// Require same quadrant as target
				h.set(n, 0);
				continue;
			}

			h.set(n, math.huge);

			for (const [j, v2] of pairs(this.locomotionMap)) {
				if (targetVelocity.X * v2.lv.X < 0 || targetVelocity.Y * v2.lv.Y < 0) {
					// Require same quadrant as target

					continue;
				}

				h.set(n, math.min(h.get(n) as number, this.get2DWeight(targetVelocity, v1.lv, v2.lv, targetSpeed, v1.speed, v2.speed)));
			}

			sum += h.get(n) as number;
		}

		// Truncates below 10% contribution
		let sum2 = 0;
		let weightedVeloX = 0;
		let weightedVeloY = 0;

		for (const [n, v] of pairs(this.locomotionMap)) {
			const num = h.get(n) as number;

			if (num / sum > 0.1) {
				sum2 += num;

				weightedVeloX += num * v.lv.X;
				weightedVeloY += num * v.lv.Y;
			} else {
				h.set(n, 0);
			}
		}

		let animSpeed;
		const weightedSpeedSquared = weightedVeloX * weightedVeloX + weightedVeloY * weightedVeloY;

		if (weightedSpeedSquared > SMALL_BUT_NOT_ZERO) {
			animSpeed = math.sqrt(targetSpeed * targetSpeed / weightedSpeedSquared);
		} else {
			animSpeed = 0;
		}

		if (!userAnimateScaleRun) {
			animSpeed /= this.getHeightScale();
		}

		let groupTimePosition = 0;

		for (const [n, v] of pairs(this.locomotionMap)) {
			if (v.track?.IsPlaying) {
				groupTimePosition = v.track.TimePosition;
				break;
			}
		}

		for (const [n, v] of pairs(this.locomotionMap)) {
			const num = h.get(n) as number;

			if (v.track) {
				if (num > 0) {
					if (!v.track.IsPlaying) {
						v.track.Play(CharacterAnimator.runBlendTime);
						v.track.TimePosition = groupTimePosition;
					}

					const weight = math.max(SMALL_BUT_NOT_ZERO, num / sum2);

					v.track?.AdjustWeight(weight, CharacterAnimator.runBlendTime);
					v.track?.AdjustSpeed(animSpeed);
				} else {
					v.track?.Stop(CharacterAnimator.runBlendTime);
				}
			}
		}
	}

	getHeightScale() {
		return userAnimateScaleRun ? (this.humanoid.Parent as Model).GetScale() : 1;
	}

	rollAnimation(name: string) {
		const entry = this.animationTable.get(name);
		let index = 0;

		if (entry) {
			let roll = math.random(1, entry.totalWeight);

			while (roll > entry.animations[index].weight) {
				roll -= entry.animations[index].weight;
				index++;
			}
		}

		return index;
	}

	playAnimation(name: string, transitionTime: number, humanoid: Humanoid) {
		const index = this.rollAnimation(name);
		const anim = this.animationTable.get(name)?.animations[index].anim;

		if (anim) {
			this.switchToAnim(anim, name, transitionTime, humanoid);
			this.currentlyPlayingEmote = false;
		}
	}

	switchToAnim(anim: Animation, name: string, transitionTime: number, humanoid: Humanoid) {
		if (anim !== this.currentAnimationInstance) {
			if (this.currentAnimationTrack) {
				this.currentAnimationTrack.Stop(transitionTime);
				this.currentAnimationTrack.Destroy();
			}

			if (this.currentAnimationKeyframeHandler) {
				this.currentAnimationKeyframeHandler.Disconnect();
			}

			this.currentAnimationSpeed = 1;

			this.currentAnimation = name;
			this.currentAnimationInstance = anim;

			if (name === "walk") {
				this.setupWalkAnimations();
			} else {
				this.destroyWalkAnimations();
				// Load to the animator, get AnimationTrack
				const track = this.animator.LoadAnimation(anim);

				this.currentAnimationTrack = track;

				track.Priority = Enum.AnimationPriority.Core;

				track.Play(transitionTime);
				// Set up keyframe name triggers
				this.currentAnimationKeyframeHandler = track.KeyframeReached.Connect((...args) => {
					this.keyFrameReachedFunc(...args);
				});
			}
		}
	}

	keyFrameReachedFunc(frameName: string) {
		if (frameName === "End") {
			let repeatAnim = this.currentAnimation;
			// return to idle if finishing an emote
			if (CharacterAnimator.emoteNames[repeatAnim] !== undefined && !CharacterAnimator.emoteNames[repeatAnim]) {
				repeatAnim = "idle";
			}

			if (this.currentlyPlayingEmote) {
				if (this.currentAnimationTrack?.Looped) return;

				repeatAnim = "idle";
				this.currentlyPlayingEmote = false;
			}

			const animSpeed = this.currentAnimationSpeed;

			this.playAnimation(repeatAnim, 0.15, this.humanoid);
			this.setAnimationSpeed(animSpeed);
		}
	}

	setAnimationSpeed(speed: number) {
		if (this.currentAnimation !== "walk" && speed !== this.currentAnimationSpeed) {
			this.currentAnimationSpeed = speed;

			this.currentAnimationTrack?.AdjustSpeed(this.currentAnimationSpeed);
		}
	}

	configureAnimationSet(name: string, fileList: AnimationData) {
		this.animationTable.get(name)?.connections.forEach((connection) => connection.Disconnect());

		const newEntry = createAnimationTableEntry();

		this.animationTable.set(name, newEntry);

		const config = script.FindFirstChild(name) as StringValue & ChangedSignal;

		if (config) {
			newEntry.connections.push(config.ChildAdded.Connect(() => this.configureAnimationSet(name, fileList)));
			newEntry.connections.push(config.ChildRemoved.Connect(() => this.configureAnimationSet(name, fileList)));

			let index = 0;

			config.GetChildren().forEach(animation => {
				if (animation.IsA("Animation")) {
					const weight = (animation.FindFirstChild("Weight") as NumberValue)?.Value ?? 1;

					newEntry.count++;

					index = newEntry.count;

					newEntry.animations[index - 1] = {
						anim: animation,
						weight: weight
					};

					newEntry.totalWeight += weight;

					newEntry.connections.push(config.Changed.Connect(() => this.configureAnimationSet(name, fileList)));
					newEntry.connections.push(config.ChildAdded.Connect(() => this.configureAnimationSet(name, fileList)));
					newEntry.connections.push(config.ChildRemoved.Connect(() => this.configureAnimationSet(name, fileList)));

					this.replaceLocomotionTrack(name, animation.GetAttribute("LinearVelocity") as Vector2);
				}
			});
		}

		// Falback to defaults
		if (newEntry.count <= 0) {
			fileList.forEach((anim, index) => {
				let animation = undefined;

				animation = new Instance("Animation");

				animation.Name = name;
				animation.AnimationId = anim.id;

				newEntry.animations[index] = {
					anim: animation,
					weight: anim.weight
				};

				newEntry.count++;
				newEntry.totalWeight += anim.weight;

				this.replaceLocomotionTrack(name, anim.lv);

				animation = undefined;
			});
		}

		// Preload animations
		for (const [_, animationType] of pairs(this.animationTable)) {
			animationType.animations.forEach((value) => {
				if (value.anim && !this.animationsPreloadState.has(value.anim?.AnimationId)) {
					this.animator.LoadAnimation(value.anim);
					this.animationsPreloadState.set(value.anim.AnimationId, true);
				}
			});
		}
	}

	replaceLocomotionTrack(name: string, lv?: Vector2) {
		let restartWalks = false;

		if (this.currentAnimation === "walk" && this.locomotionMap.has(name)) {
			// Need to tear down and startup locomotion
			this.destroyWalkAnimations();

			restartWalks = true;
		}

		if (lv) {
			this.strafingLocomotionMap.set(name, { lv: lv, speed: lv.Magnitude } as LocomotionMapEntry);
		} else {
			this.strafingLocomotionMap.delete(name);
		}

		if (name === "run" || name === "walk") {
			if (lv) {
				this.fallbackLocomotionMap.set(name, this.strafingLocomotionMap.get(name) as LocomotionMapEntry);
			} else {
				const speed = name === "run" ? CharacterAnimator.RUN_SPEED : CharacterAnimator.WALK_SPEED;

				this.fallbackLocomotionMap.set(name, { lv: new Vector2(0, speed), speed: speed } as LocomotionMapEntry);
				this.strafingLocomotionMap.delete(name);
			}
		}

		if (restartWalks) {
			this.setupWalkAnimations();
			this.lastBlendTime = 0;
		}
	}

	setupWalkAnimations() {
		this.resetVelocityBounds();
		// check to see if we need to blend a walk/run animation
		for (const [n, v] of pairs(this.strafingLocomotionMap)) {
			this.updateVelocityBounds(v.lv);
		}

		this.checkStrafingEnabled();

		for (const [name, entry] of pairs(this.locomotionMap)) {
			entry.track = this.animator.LoadAnimation(this.animationTable.get(name)?.animations[0].anim as Animation);
			entry.track.Priority = Enum.AnimationPriority.Core;
		}
	}

	checkStrafingEnabled() {
		if (this.minVeloX === 0 || this.minVeloY === 0 || this.maxVeloX === 0 || this.maxVeloY === 0) {
			if (this.locomotionMap === this.strafingLocomotionMap) {
				warn(`Strafe blending disabled. Not all quadrants of motion represented.`);
			}

			this.locomotionMap = this.fallbackLocomotionMap;
		} else if (!this.strafingLocomotionMap.has("run") || !this.strafingLocomotionMap.has("walk")) {
			if (this.locomotionMap === this.strafingLocomotionMap) {
				warn(`Strafe blending disabled. Run and walk must be strafing-friendly.`);
			}

			this.locomotionMap = this.fallbackLocomotionMap;
		} else if (this.locomotionMap !== this.strafingLocomotionMap) {
			this.locomotionMap = this.strafingLocomotionMap;

			warn(`Strafing re-enabled`);
		}
	}

	resetVelocityBounds() {
		this.minVeloX = 0;
		this.minVeloY = 0;
		this.maxVeloX = 0;
		this.maxVeloY = 0;
	}

	updateVelocityBounds(velocity?: Vector2) {
		if (velocity) {
			this.maxVeloX = math.max(velocity.X, this.maxVeloX);
			this.minVeloX = math.max(velocity.X, this.minVeloX);
			this.maxVeloY = math.max(velocity.Y, this.maxVeloY);
			this.minVeloY = math.max(velocity.Y, this.minVeloY);
		}
	}

	destroyWalkAnimations() {
		this.strafingLocomotionMap.forEach(value => {
			if (value.track) {
				value.track.Stop();
				value.track.Destroy();
				value.track = undefined;
			}
		});

		this.fallbackLocomotionMap.forEach(value => {
			if (value.track) {
				value.track.Stop();
				value.track.Destroy();
				value.track = undefined;
			}
		});

		this.cachedRunningSpeed = 0;
	}
}