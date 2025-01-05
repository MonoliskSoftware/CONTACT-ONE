import Object from "@rbxts/object-utils";
import { ContextActionService, GuiService, Players, RunService, UserInputService, VRService, Workspace } from "@rbxts/services";
import { Connection, Signal } from "CORP/shared/Libraries/Signal";
import { FlagUtil } from "../FlagUtil";

// Imports
const UserGameSettings = UserSettings().GetService("UserGameSettings");
const player = Players.LocalPlayer;

// FFlags
const FFlagUserCameraInputDt = FlagUtil.getUserFlag("UserCameraInputDt");
const FFlagUserFixGamepadSensitivity = FlagUtil.getUserFlag("UserFixGamepadSensitivity");
const FFlagUserClearPanOnCameraDisable = FlagUtil.getUserFlag("UserClearPanOnCameraDisable");
const FFlagUserResetTouchStateOnMenuOpen = FlagUtil.getUserFlag("UserResetTouchStateOnMenuOpen");

// Constants
const MIN_TOUCH_SENSITIVITY_FRACTION = 0.25; // 25% sensitivity at 90°

const CAMERA_INPUT_PRIORITY = Enum.ContextActionPriority.Medium.Value;
const MB_TAP_LENGTH = 0.3; // (s) length of time for a short mouse button tap to be registered

// Rotation speed constants
const ROTATION_SPEED_KEYS = math.rad(120); // (rad/s)
const ROTATION_SPEED_GAMEPAD = new Vector2(1, 0.77).mul(math.rad(4)).mul(FFlagUserCameraInputDt ? 60 : 1); // (rad/s)

// Zoom constants
const ZOOM_SPEED_MOUSE = 1; // (scaled studs/wheel click)
const ZOOM_SPEED_KEYS = 0.1; // (studs/s)
const ZOOM_SPEED_TOUCH = 0.04; // (scaled studs/DIP %)

// these speeds should not be scaled by dt because the input returned is not normalized. 
// that is, at lower framerates, the magnitude of the input delta will be larger because the pointer/mouse/touch
// has moved more pixels between frames.
const ROTATION_SPEED_MOUSE = new Vector2(1, 0.77).mul(math.rad(0.5)); // (rad/inputdelta)
const ROTATION_SPEED_POINTERACTION = new Vector2(1, 0.77).mul(math.rad(7)); // (rad/inputdelta)
const ROTATION_SPEED_TOUCH = new Vector2(1, 0.66).mul(math.rad(1)); // (rad/inputdelta)

interface InputStateObject {
	[key: string]: Vector2 | number | boolean
}

let worldDeltaTime = 1 / 60;

RunService.Stepped.Connect((_, delta) => worldDeltaTime = delta);

// Thumbstick curving
const K_CURVATURE = 2; // amount of upwards curvature (0 is flat)
const K_DEADZONE = 0.1; // deadzone

function thumbstickCurve(x: number) {
	// remove sign, apply linear deadzone
	const fDeadzone = (math.abs(x) - K_DEADZONE) / (1 - K_DEADZONE);

	// apply exponential curve and scale to fit in [0, 1]
	const fCurve = (math.exp(K_CURVATURE * fDeadzone) - 1) / (math.exp(K_CURVATURE) - 1);

	// reapply sign and clamp
	return math.sign(x) * math.clamp(fCurve, 0, 1);
}

/**
 * Adjust the touch sensitivity so that sensitivity is reduced when swiping up
 * or down, but stays the same when swiping towards the middle of the screen
 */
function adjustTouchPitchSensitivity(delta: Vector2): Vector2 {
	const camera = Workspace.CurrentCamera;

	if (!camera) return delta;

	// get the camera pitch in world space
	const [pitch] = camera.CFrame.ToEulerAnglesXYZ();

	if (delta.Y * pitch >= 0) {
		// do not reduce sensitivity when pitching towards the horizon
		return delta;
	}

	// set up a line to fit:
	// 1 = f(0)
	// 1 = f(±pi/2)
	const curveY = 1 - (2 * math.abs(pitch) / math.pi) ^ 0.75;

	// remap curveY from [0, 1] -> [MIN_TOUCH_SENSITIVITY_FRACTION, 1]
	const sensitivity = curveY * (1 - MIN_TOUCH_SENSITIVITY_FRACTION) + MIN_TOUCH_SENSITIVITY_FRACTION;

	return new Vector2(delta.X, sensitivity * delta.Y);
}

function isInDynamicThumbstickArea(pos: Vector3): boolean {
	const playerGui = player.FindFirstChildOfClass("PlayerGui");
	const touchGui = playerGui && playerGui.FindFirstChild("TouchGui") as ScreenGui;
	const touchFrame = touchGui && touchGui.FindFirstChild("TouchControlFrame") as Frame;
	const thumbstickFrame = touchFrame && touchFrame.FindFirstChild("DynamicThumbstickFrame") as Frame;

	if (!thumbstickFrame || !touchGui.Enabled) return false;


	const posTopLeft = thumbstickFrame.AbsolutePosition;
	const posBottomRight = posTopLeft.add(thumbstickFrame.AbsoluteSize);

	return pos.X >= posTopLeft.X &&
		pos.Y >= posTopLeft.Y &&
		pos.X <= posBottomRight.X &&
		pos.Y <= posBottomRight.Y;
}

namespace RightMouseButtonEvents {
	export const rmbDown = new Signal<[]>("rmbDown");
	export const rmbUp = new Signal<[]>("rmbUp");

	UserInputService.InputBegan.Connect((input, gpe) => {
		if (!gpe && input.UserInputType === Enum.UserInputType.MouseButton2) rmbDown.fire();
	});

	UserInputService.InputEnded.Connect((input, gpe) => {
		if (input.UserInputType === Enum.UserInputType.MouseButton2) rmbUp.fire();
	});
}

export namespace CameraInput {
	const connectionList: RBXScriptConnection[] = [];
	let panInputCount = 0;

	// States
	const currentGamepadState = {
		Thumbstick2: Vector2.zero
	} satisfies InputStateObject;

	const currentKeyboardState = {
		Left: 0,
		Right: 0,
		I: 0,
		O: 0,
	} satisfies InputStateObject;

	const currentMouseState = {
		Movement: Vector2.zero,
		Wheel: 0, // PointerAction
		Pan: Vector2.zero, // PointerAction
		Pinch: 0, // PointerAction
	} satisfies InputStateObject;

	const currentTouchState = {
		Move: Vector2.zero,
		Pinch: 0
	} satisfies InputStateObject;

	export const onGamepadZoomPress = new Signal<[]>("gamepadZoomPress");
	export const onGamepadReset = VRService.VREnabled && new Signal<[]>("gamepadReset");

	export function incPanInputCount() {
		panInputCount = math.max(0, panInputCount + 1);
	}

	export function decPanInputCount() {
		panInputCount = math.max(0, panInputCount - 1);
	}

	export function resetPanInputCount() {
		panInputCount = 0;
	}

	export function getRotationActivated(): boolean {
		return panInputCount > 0 || currentGamepadState.Thumbstick2.Magnitude > 0;
	}

	export function getRotation(deltaTime: number, disableKeyboardRotation?: boolean): Vector2 {
		const inversionVector = new Vector2(1, UserGameSettings.GetCameraYInvertValue());

		// keyboard input is non-coalesced, so must account for time delta
		const kKeyboard = disableKeyboardRotation ? Vector2.zero : new Vector2(currentKeyboardState.Right - currentKeyboardState.Left, 0).mul(FFlagUserCameraInputDt ? deltaTime : worldDeltaTime);

		const kGamepad = currentGamepadState.Thumbstick2
			.mul(FFlagUserFixGamepadSensitivity ? UserGameSettings.GamepadCameraSensitivity : 1)
			.mul(FFlagUserCameraInputDt ? deltaTime : 1); // inline with FFlagUserCameraInputDt

		const kMouse = currentMouseState.Movement;
		const kPointerAction = currentMouseState.Pan;
		const kTouch = adjustTouchPitchSensitivity(currentTouchState.Move);

		const result =
			kKeyboard.mul(ROTATION_SPEED_KEYS).add(
				kGamepad.mul(ROTATION_SPEED_GAMEPAD).add(
					kMouse.mul(ROTATION_SPEED_MOUSE).add(
						kPointerAction.mul(ROTATION_SPEED_POINTERACTION).add(
							kTouch.mul(ROTATION_SPEED_TOUCH)))));

		return result.mul(inversionVector);
	}

	export function getZoomDelta(): number {
		const kKeyboard = currentKeyboardState.O - currentKeyboardState.I;
		const kMouse = -currentMouseState.Wheel + currentMouseState.Pinch;
		const kTouch = -currentTouchState.Pinch;

		return kKeyboard * ZOOM_SPEED_KEYS + kMouse * ZOOM_SPEED_MOUSE + kTouch * ZOOM_SPEED_TOUCH;
	}

	namespace InputHandling {
		// INPUT SPECIFIC METHODS
		export function thumbstick(action: string, state: Enum.UserInputState, input: InputObject): Enum.ContextActionResult {
			const position = input.Position;

			currentGamepadState[input.KeyCode.Name as "Thumbstick2"] = new Vector2(thumbstickCurve(position.X), -thumbstickCurve(position.Y));

			return Enum.ContextActionResult.Pass;
		}

		export function mouseMovement(input: InputObject) {
			const delta = input.Delta;

			currentMouseState.Movement = new Vector2(delta.X, delta.Y);
		}

		export function keypress(action: string, state: Enum.UserInputState, input: InputObject): void {
			currentKeyboardState[input.KeyCode.Name as keyof typeof currentKeyboardState] = state === Enum.UserInputState.Begin ? 1 : 0;
		}

		export function gamepadZoomPress(action: string, state: Enum.UserInputState, input: InputObject) {
			if (state === Enum.UserInputState.Begin) onGamepadZoomPress.fire();
		}

		export function gamepadReset(action: string, state: Enum.UserInputState, input: InputObject) {
			if (state === Enum.UserInputState.Begin && onGamepadReset) onGamepadReset.fire();
		}

		// TOUCH METHODS
		export namespace TouchHandling {
			// Use TouchPan & TouchPinch when they work in the Studio emulator
			const touches = new Map<InputObject, boolean>(); // {[InputObject] = sunk}
			let dynamicThumbstickInput: InputObject | undefined; // Special-cased 
			let lastPinchDiameter: number | undefined;

			export function touchBegan(input: InputObject, sunk: boolean) {
				assert(input.UserInputType === Enum.UserInputType.Touch);
				assert(input.UserInputState === Enum.UserInputState.Begin);

				if (dynamicThumbstickInput === undefined && isInDynamicThumbstickArea(input.Position) && !sunk) {
					// any finger down starting in the dynamic thumbstick area should always be
					// ignored for camera purposes. these must be handled specially from all other
					// inputs, as the DT does not sink inputs by itself
					dynamicThumbstickInput = input;

					return;
				}

				if (!sunk) incPanInputCount();

				// register the finger
				touches.set(input, sunk);
			}

			export function touchEnded(input: InputObject, sunk: boolean) {
				assert(input.UserInputType === Enum.UserInputType.Touch);
				assert(input.UserInputState === Enum.UserInputState.End);

				// reset the DT input
				if (input === dynamicThumbstickInput) dynamicThumbstickInput = undefined;

				// reset pinch state if one unsunk finger lifts
				if (touches.get(input) === false) {
					lastPinchDiameter = undefined;

					decPanInputCount();
				}

				// unregister input
				touches.delete(input);
			}

			export function touchChanged(input: InputObject, sunk: boolean) {
				assert(input.UserInputType === Enum.UserInputType.Touch);
				assert(input.UserInputState === Enum.UserInputState.Change);

				// ignore movement from the DT finger
				if (input === dynamicThumbstickInput) return;

				// fixup unknown touches
				if (!touches.has(input)) touches.set(input, sunk);

				// collect unsunk touches
				const unsunkTouches = Object.keys(touches).filter(touch => !touches.get(touch));

				// 1 finger: pan
				if (unsunkTouches.size() === 1 && touches.get(input) === false) currentTouchState.Move = currentTouchState.Move.add(new Vector2(input.Delta.X, input.Delta.Y));

				// 2 fingers: pinch
				if (unsunkTouches.size() === 2) {
					const pinchDiameter = (unsunkTouches[0].Position.sub(unsunkTouches[1].Position)).Magnitude;

					if (lastPinchDiameter !== undefined) currentTouchState.Pinch += pinchDiameter - lastPinchDiameter;

					lastPinchDiameter = pinchDiameter;
				} else {
					lastPinchDiameter = undefined;
				}
			}

			export function resetTouchState() {
				touches.clear();
				dynamicThumbstickInput = undefined;
				lastPinchDiameter = undefined;

				if (FFlagUserResetTouchStateOnMenuOpen) resetPanInputCount();
			}
		}

		// INPUT BINDING METHODS
		export function pointerAction(wheel: number, pan: Vector2, pinch: number, gpe: boolean) {
			if (!gpe) {
				currentMouseState.Wheel = wheel;
				currentMouseState.Pan = pan;
				currentMouseState.Pinch = -pinch;
			}
		}

		export function inputBegan(input: InputObject, sunk: boolean) {
			if (input.UserInputType === Enum.UserInputType.Touch) {
				TouchHandling.touchBegan(input, sunk);
			} else if (input.UserInputType === Enum.UserInputType.MouseButton2 && !sunk) {
				incPanInputCount();
			}
		}

		export function inputChanged(input: InputObject, sunk: boolean) {
			if (input.UserInputType === Enum.UserInputType.Touch) {
				TouchHandling.touchChanged(input, sunk);
			} else if (input.UserInputType === Enum.UserInputType.MouseMovement) {
				mouseMovement(input);
			}
		}

		export function inputEnded(input: InputObject, sunk: boolean) {
			if (input.UserInputType === Enum.UserInputType.Touch) {
				TouchHandling.touchEnded(input, sunk);
			} else if (input.UserInputType === Enum.UserInputType.MouseButton2) {
				decPanInputCount();
			}
		}

		export function resetInputDevices() {
			const states: InputStateObject[] = [currentGamepadState, currentKeyboardState, currentMouseState, currentTouchState];

			states.forEach(state => Object.keys(state).forEach(key =>
				state[key] = typeIs(state[key], "boolean") ? false : typeIs(state[key], "number") ? state[key] * 0 : state[key].mul(0)
			));

			if (FFlagUserClearPanOnCameraDisable) {
				resetPanInputCount();
			}
		}
	}

	let inputEnabled = false;

	export function setInputEnabled(_inputEnabled: boolean) {
		if (inputEnabled === _inputEnabled) return;

		inputEnabled = _inputEnabled;

		InputHandling.resetInputDevices();
		InputHandling.TouchHandling.resetTouchState();

		if (inputEnabled) {
			ContextActionService.BindActionAtPriority(
				"RbxCameraThumbstick",
				(...args) => InputHandling.thumbstick(...args),
				false,
				CAMERA_INPUT_PRIORITY,
				Enum.KeyCode.Thumbstick2
			);

			ContextActionService.BindActionAtPriority(
				"RbxCameraKeypress",
				(...args) => InputHandling.keypress(...args),
				false,
				CAMERA_INPUT_PRIORITY,
				Enum.KeyCode.Left,
				Enum.KeyCode.Right,
				Enum.KeyCode.I,
				Enum.KeyCode.O
			);

			if (VRService.VREnabled) {
				ContextActionService.BindAction(
					"RbxCameraGamepadReset",
					(...args) => InputHandling.gamepadReset(...args),
					false,
					Enum.KeyCode.ButtonL3
				);
			}

			ContextActionService.BindAction(
				"RbxCameraGamepadZoom",
				(...args) => InputHandling.gamepadZoomPress(...args),
				false,
				Enum.KeyCode.ButtonR3
			);

			connectionList.push(UserInputService.InputBegan.Connect(InputHandling.inputBegan));
			connectionList.push(UserInputService.InputChanged.Connect(InputHandling.inputChanged));
			connectionList.push(UserInputService.InputEnded.Connect(InputHandling.inputEnded));
			connectionList.push(UserInputService.PointerAction.Connect(InputHandling.pointerAction));

			if (FFlagUserResetTouchStateOnMenuOpen) connectionList.push(GuiService.MenuOpened.Connect(InputHandling.TouchHandling.resetTouchState));
		} else {
			ContextActionService.UnbindAction("RbxCameraThumbstick");
			ContextActionService.UnbindAction("RbxCameraMouseMove");
			ContextActionService.UnbindAction("RbxCameraMouseWheel");
			ContextActionService.UnbindAction("RbxCameraKeypress");

			ContextActionService.UnbindAction("RbxCameraGamepadZoom");
			if (VRService.VREnabled) {
				ContextActionService.UnbindAction("RbxCameraGamepadReset");
			}

			connectionList.forEach(con => con.Disconnect());
			connectionList.clear();
		}
	}

	export function getInputEnabled() {
		return inputEnabled;
	}

	export function resetInputForFrameEnd() {
		currentMouseState.Movement = Vector2.zero;
		currentTouchState.Move = Vector2.zero;
		currentTouchState.Pinch = 0;
		
		currentMouseState.Wheel = 0; // PointerAction
		currentMouseState.Pan = Vector2.zero; // PointerAction
		currentMouseState.Pinch = 0; // PointerAction
	}

	// Panning
	let holdPan = false;
	let togglePan = false;
	let lastRmbDown = 0; // tick() timestamp of last right mouse button down event

	export function getHoldPan(): boolean {
		return holdPan;
	}

	export function getTogglePan(): boolean {
		return togglePan;
	}

	export function getPanning(): boolean {
		return togglePan || holdPan;
	}

	export function setTogglePan(value: boolean) {
		togglePan = value;
	}

	// Camera toggling
	let cameraToggleInputEnabled = false;
	let rmbDownConnection: Connection<[]> | undefined;
	let rmbUpConnection: Connection<[]> | undefined;

	export function enableCameraToggleInput() {
		if (cameraToggleInputEnabled) return;

		cameraToggleInputEnabled = true;

		holdPan = false;
		togglePan = false;

		rmbDownConnection?.Disconnect();
		rmbUpConnection?.Disconnect();

		rmbDownConnection = RightMouseButtonEvents.rmbDown.Connect(() => [holdPan, lastRmbDown] = [true, tick()]);

		rmbUpConnection = RightMouseButtonEvents.rmbUp.Connect(() => {
			holdPan = false;

			if (tick() - lastRmbDown < MB_TAP_LENGTH && (togglePan || UserInputService.GetMouseDelta().Magnitude < 2)) togglePan = !togglePan;
		});
	}

	export function disableCameraToggleInput() {
		if (cameraToggleInputEnabled) return;

		cameraToggleInputEnabled = false;
	
		rmbDownConnection?.Disconnect();
		rmbUpConnection?.Disconnect();

		rmbDownConnection = undefined;
		rmbUpConnection = undefined;
	}
}