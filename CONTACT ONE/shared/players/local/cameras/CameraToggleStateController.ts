import { CameraInput } from "./CameraInput";
import { CameraUI } from "./CameraUI";
import { CameraUtils } from "./CameraUtils";

let lastTogglePan = false;
let lastTogglePanChange = tick();

const CROSS_MOUSE_ICON = "rbxasset://textures/Cursors/CrossMouseIcon.png";

let lockStateDirty = false;
let wasTogglePanOnTheLastTimeYouWentIntoFirstPerson = false;
let lastFirstPerson = false;

CameraUI.setCameraModeToastEnabled(false);

export function CameraToggleStateController(isFirstPerson: boolean) {
	const togglePan = CameraInput.getTogglePan();
	const toastTimeout = 3;

	if (isFirstPerson && togglePan !== lastTogglePan) {
		lockStateDirty = true;
	}

	if (lastTogglePan !== togglePan || tick() - lastTogglePanChange > toastTimeout) {
		const doShow = togglePan && tick() - lastTogglePanChange < toastTimeout;

		CameraUI.setCameraModeToastOpen(doShow);

		if (togglePan) {
			lockStateDirty = false;
		}
		lastTogglePanChange = tick();
		lastTogglePan = togglePan;
	}

	if (isFirstPerson !== lastFirstPerson) {
		if (isFirstPerson) {
			wasTogglePanOnTheLastTimeYouWentIntoFirstPerson = CameraInput.getTogglePan();
			CameraInput.setTogglePan(true);
		} else if (! lockStateDirty ) {
			CameraInput.setTogglePan(wasTogglePanOnTheLastTimeYouWentIntoFirstPerson);
		}
	}

	if (isFirstPerson) {
		if (CameraInput.getTogglePan()) {
			CameraUtils.setMouseIconOverride(CROSS_MOUSE_ICON);
			CameraUtils.setMouseBehaviorOverride(Enum.MouseBehavior.LockCenter);
			CameraUtils.setRotationTypeOverride(Enum.RotationType.CameraRelative);
		} else {
			CameraUtils.restoreMouseIcon();
			CameraUtils.restoreMouseBehavior();
			CameraUtils.setRotationTypeOverride(Enum.RotationType.CameraRelative);
		}

	} else if (CameraInput.getTogglePan()) {
		CameraUtils.setMouseIconOverride(CROSS_MOUSE_ICON);
		CameraUtils.setMouseBehaviorOverride(Enum.MouseBehavior.LockCenter);
		CameraUtils.setRotationTypeOverride(Enum.RotationType.MovementRelative);

	} else if (CameraInput.getHoldPan()) {
		CameraUtils.restoreMouseIcon();
		CameraUtils.setMouseBehaviorOverride(Enum.MouseBehavior.LockCurrentPosition);
		CameraUtils.setRotationTypeOverride(Enum.RotationType.MovementRelative);

	} else {
		CameraUtils.restoreMouseIcon();
		CameraUtils.restoreMouseBehavior();
		CameraUtils.restoreRotationType();
	}

	lastFirstPerson = isFirstPerson;
}