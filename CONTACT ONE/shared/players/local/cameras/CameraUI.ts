import { StarterGui } from "@rbxts/services";

let initialized = false;

export namespace CameraUI {
	// Instantaneously disable the toast or enable for opening later on. Used when switching camera modes.
	export function setCameraModeToastEnabled(enabled: boolean) {
		if (!enabled && !initialized) {
			return;
		}

		if (!initialized) {
			initialized = true;
		}

		if (!enabled) {
			CameraUI.setCameraModeToastOpen(false);
		}
	}

	export function setCameraModeToastOpen(open: boolean) {
		assert(initialized);

		if (open) {
			StarterGui.SetCore("SendNotification", {
				Title: "Camera Control Enabled",
				Text: "Right click to toggle",
				Duration: 3,
			});
		}
	}
}