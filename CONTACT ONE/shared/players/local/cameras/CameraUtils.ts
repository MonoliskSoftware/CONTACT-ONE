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