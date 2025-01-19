import { Players, UserInputService } from "@rbxts/services";

const UserGameSettings = UserSettings().GetService("UserGameSettings");

function getMouse() {
	let localPlayer = Players.LocalPlayer;

	if (!localPlayer) {
		Players.GetPropertyChangedSignal("LocalPlayer").Wait();
		localPlayer = Players.LocalPlayer;
	}

	assert(localPlayer);

	return localPlayer.GetMouse();
}

export namespace CameraUtils {
	export type AllCameraMovementModes = Enum.TouchCameraMovementMode |
		Enum.ComputerCameraMovementMode |
		Enum.DevTouchCameraMovementMode |
		Enum.DevComputerCameraMovementMode

	export type StandardizedMovementModes =
		Enum.ComputerCameraMovementMode |
		Enum.DevComputerCameraMovementMode

	export class Spring {
		freq: number;
		pos: number;
		goal: number;
		vel: number;

		constructor(freq: number, pos: number) {
			this.freq = freq;
			this.pos = pos;
			this.goal = pos;
			this.vel = 0;
		}

		/**
		 * Advance the spring simulation by `dt` seconds
		 */
		step(dt: number) {
			const f: number = this.freq as number * 2.0 * math.pi;
			const g: number = this.goal;
			const p0: number = this.pos;
			const v0: number = this.vel;

			const offset = p0 - g;
			const decay = math.exp(-f * dt);

			const p1 = (offset * (1 + f * dt) + v0 * dt) * decay + g;
			const v1 = (v0 * (1 - f * dt) - offset * (f * f * dt)) * decay;

			this.pos = p1;
			this.vel = v1;

			return p1;
		}
	}

	// From TransparencyController
	export function Round(num: number, places: number): number {
		const decimalPivot = 10 ^ places;

		return math.floor(num * decimalPivot + 0.5) / decimalPivot;
	}

	export function map(x: number, inMin: number, inMax: number, outMin: number, outMax: number): number {
		return (x - inMin) * (outMax - outMin) / (inMax - inMin) + outMin;
	}


	export function IsFiniteVector3(vec3: Vector3): boolean {
		return IsFinite(vec3.X) && IsFinite(vec3.Y) && IsFinite(vec3.Z);
	}

	export function IsFinite(val: number): boolean {
		return val === val && val !== math.huge && val !== -math.huge;
	}

	// Legacy implementation renamed
	export function GetAngleBetweenXZVectors(v1: Vector3, v2: Vector3) {
		return math.atan2(v2.X * v1.Z - v2.Z * v1.X, v2.X * v1.X + v2.Z * v1.Z);
	}

	export function ConvertCameraModeEnumToStandard(enumValue:
		Enum.TouchCameraMovementMode |
		Enum.ComputerCameraMovementMode |
		Enum.DevTouchCameraMovementMode |
		Enum.DevComputerCameraMovementMode): Enum.ComputerCameraMovementMode | Enum.DevComputerCameraMovementMode {
		if (enumValue === Enum.TouchCameraMovementMode.Default) {
			return Enum.ComputerCameraMovementMode.Follow;
		}

		if (enumValue === Enum.ComputerCameraMovementMode.Default) {
			return Enum.ComputerCameraMovementMode.Classic;
		}

		if (enumValue === Enum.TouchCameraMovementMode.Classic ||
			enumValue === Enum.DevTouchCameraMovementMode.Classic ||
			enumValue === Enum.DevComputerCameraMovementMode.Classic ||
			enumValue === Enum.ComputerCameraMovementMode.Classic) {
			return Enum.ComputerCameraMovementMode.Classic;
		}

		if (enumValue === Enum.TouchCameraMovementMode.Follow ||
			enumValue === Enum.DevTouchCameraMovementMode.Follow ||
			enumValue === Enum.DevComputerCameraMovementMode.Follow ||
			enumValue === Enum.ComputerCameraMovementMode.Follow) {
			return Enum.ComputerCameraMovementMode.Follow;
		}

		if (enumValue === Enum.TouchCameraMovementMode.Orbital ||
			enumValue === Enum.DevTouchCameraMovementMode.Orbital ||
			enumValue === Enum.DevComputerCameraMovementMode.Orbital ||
			enumValue === Enum.ComputerCameraMovementMode.Orbital) {
			return Enum.ComputerCameraMovementMode.Orbital;
		}

		if (enumValue === Enum.ComputerCameraMovementMode.CameraToggle ||
			enumValue === Enum.DevComputerCameraMovementMode.CameraToggle) {
			return Enum.ComputerCameraMovementMode.CameraToggle;
		}

		// Note: Only the Dev versions of the Enums have UserChoice as an option
		if (enumValue === Enum.DevTouchCameraMovementMode.UserChoice ||
			enumValue === Enum.DevComputerCameraMovementMode.UserChoice) {
			return Enum.DevComputerCameraMovementMode.UserChoice;
		}

		// For any unmapped options return Classic camera
		return Enum.ComputerCameraMovementMode.Classic;
	}

	let savedRotationType: Enum.RotationType = Enum.RotationType.MovementRelative;
	let lastRotationTypeOverride: Enum.RotationType | undefined;

	export function setRotationTypeOverride(value: Enum.RotationType) {
		if (UserGameSettings.RotationType !== lastRotationTypeOverride) {
			savedRotationType = UserGameSettings.RotationType;
		}

		UserGameSettings.RotationType = value;
		lastRotationTypeOverride = value;
	}

	let savedMouseBehavior: Enum.MouseBehavior = Enum.MouseBehavior.Default;
	let lastMouseBehaviorOverride: Enum.MouseBehavior | undefined;

	export function setMouseBehaviorOverride(value: Enum.MouseBehavior) {
		if (UserInputService.MouseBehavior !== lastMouseBehaviorOverride) {
			savedMouseBehavior = UserInputService.MouseBehavior;
		}

		UserInputService.MouseBehavior = value;
		lastMouseBehaviorOverride = value;
	}

	export function restoreRotationType() {
		if (UserGameSettings.RotationType === lastRotationTypeOverride) {
			UserGameSettings.RotationType = savedRotationType;
		}

		lastRotationTypeOverride = undefined;
	}

	export function restoreMouseBehavior() {
		if (UserInputService.MouseBehavior === lastMouseBehaviorOverride) {
			UserInputService.MouseBehavior = savedMouseBehavior;
		}

		lastMouseBehaviorOverride = undefined;
	}

	let savedMouseIcon: string = "";
	let lastMouseIconOverride: string | undefined;

	export function setMouseIconOverride(icon: string) {
		const mouse = getMouse();

		// Only save the icon if it was written by another script.
		if (mouse.Icon !== lastMouseIconOverride) {
			savedMouseIcon = mouse.Icon;
		}

		mouse.Icon = icon;
		lastMouseIconOverride = icon;
	}

	export function restoreMouseIcon() {
		const mouse = getMouse();

		// Only restore if it wasn't overwritten by another script.
		if (mouse.Icon === lastMouseIconOverride) {
			mouse.Icon = savedMouseIcon;
		}

		lastMouseIconOverride = undefined;
	}
}