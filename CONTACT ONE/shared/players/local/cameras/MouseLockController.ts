import { ContextActionService, Players } from "@rbxts/services";
import { Signal } from "CORP/shared/Libraries/Signal";
import { FlagUtil } from "../FlagUtil";
import { CameraUtils } from "./CameraUtils";

const UserGameSettings = UserSettings().GetService("UserGameSettings");

const FFlagUserFixCameraOffsetJitter = FlagUtil.getUserFlag("UserFixCameraOffsetJitter2");

const DEFAULT_MOUSE_LOCK_CURSOR = "rbxasset://textures/MouseLockedCursor.png";
const CONTEXT_ACTION_NAME = "MouseLockSwitchAction";
const MOUSELOCK_ACTION_PRIORITY = Enum.ContextActionPriority.Medium.Value;
const CAMERA_OFFSET_DEFAULT = new Vector3(1.75, 0, 0);

export class MouseLockController {
	enabled = false;
	isMouseLocked = false;
	savedMouseCursor: undefined;
	boundKeys: Enum.KeyCode[] = [Enum.KeyCode.LeftShift, Enum.KeyCode.RightShift];

	mouseLockToggledEvent = new Signal<[]>("mouseLockToggledEvent");

	constructor() {
		let boundKeysObj: Instance | StringValue | undefined = script.FindFirstChild("BoundKeys") as StringValue;

		if (!boundKeysObj || !boundKeysObj.IsA("StringValue")) {
			// If object with correct name was found, but it's not a StringValue, destroy and replace
			boundKeysObj?.Destroy();

			boundKeysObj = new Instance("StringValue") as StringValue;
			// Luau FIXME: should be able to infer from assignment above that boundKeysObj is not nil?
			assert(boundKeysObj && boundKeysObj.IsA("StringValue"));

			boundKeysObj.Name = "BoundKeys";
			boundKeysObj.Value = this.boundKeys.map(value => value.Name).join(",");
			boundKeysObj.Parent = script;
		} else if (boundKeysObj) {
			boundKeysObj.Changed.Connect(value => this.OnBoundKeysObjectChanged(value));

			this.OnBoundKeysObjectChanged(boundKeysObj.Value); // Initial setup call
		}

		// Watch for changes to user's ControlMode and ComputerMovementMode settings and update the feature availability accordingly
		(UserGameSettings as UserGameSettings & ChangedSignal).Changed.Connect(property => {
			if (property === "ControlMode" || property === "ComputerMovementMode") {
				this.UpdateMouseLockAvailability();
			}
		});

		// Watch for changes to DevEnableMouseLock and update the feature availability accordingly
		Players.LocalPlayer.GetPropertyChangedSignal("DevEnableMouseLock").Connect(() => this.UpdateMouseLockAvailability());
		// Watch for changes to DevEnableMouseLock and update the feature availability accordingly
		Players.LocalPlayer.GetPropertyChangedSignal("DevComputerMovementMode").Connect(() => this.UpdateMouseLockAvailability());

		this.UpdateMouseLockAvailability();
	}

	OnBoundKeysObjectChanged(value: string): void {
		this.boundKeys = []; // Overriding defaults, note: possibly with nothing at all if boundKeysObj.Value is "" or contains invalid values

		this.boundKeys = value.split(",").reduce((accumulator, token) => {
			const enumItem = Enum.KeyCode.GetEnumItems().find(item => token === item.Name);

			if (enumItem) accumulator.push(enumItem);

			return accumulator;
		}, [] as Enum.KeyCode[]);

		this.UnbindContextActions();
		this.BindContextActions();
	}

	UnbindContextActions() {
		ContextActionService.UnbindAction(CONTEXT_ACTION_NAME);
	}

	DoMouseLockSwitch(name: string, state: Enum.UserInputState, input: InputObject) {
		if (state === Enum.UserInputState.Begin) {
			this.OnMouseLockToggled();

			return Enum.ContextActionResult.Sink;
		}

		return Enum.ContextActionResult.Pass;
	}

	//[[ Local Functions ]]
	OnMouseLockToggled() {
		this.isMouseLocked = !this.isMouseLocked;

		if (this.isMouseLocked) {
			let cursorImageValueObj: StringValue | undefined = script.FindFirstChild("CursorImage") as StringValue | undefined;

			if (cursorImageValueObj && cursorImageValueObj.IsA("StringValue") && cursorImageValueObj.Value) {
				CameraUtils.setMouseIconOverride(cursorImageValueObj.Value);
			} else {
				cursorImageValueObj?.Destroy();

				cursorImageValueObj = new Instance("StringValue");
				assert(cursorImageValueObj);

				cursorImageValueObj.Name = "CursorImage";
				cursorImageValueObj.Value = DEFAULT_MOUSE_LOCK_CURSOR;
				cursorImageValueObj.Parent = script;

				CameraUtils.setMouseIconOverride(DEFAULT_MOUSE_LOCK_CURSOR);
			}
		} else {
			CameraUtils.restoreMouseIcon();
		}

		this.mouseLockToggledEvent.fire();
	}

	BindContextActions() {
		ContextActionService.BindActionAtPriority(CONTEXT_ACTION_NAME, (name, state, input) => this.DoMouseLockSwitch(name, state, input), false, MOUSELOCK_ACTION_PRIORITY, ...this.boundKeys);
	}

	UpdateMouseLockAvailability() {
		const devAllowsMouseLock = Players.LocalPlayer.DevEnableMouseLock;
		const devMovementModeIsScriptable = Players.LocalPlayer.DevComputerMovementMode === Enum.DevComputerMovementMode.Scriptable;
		const userHasMouseLockModeEnabled = UserGameSettings.ControlMode === Enum.ControlMode.MouseLockSwitch;
		const userHasClickToMoveEnabled = UserGameSettings.ComputerMovementMode === Enum.ComputerMovementMode.ClickToMove;
		const MouseLockAvailable = devAllowsMouseLock && userHasMouseLockModeEnabled && !userHasClickToMoveEnabled && !devMovementModeIsScriptable;

		if (MouseLockAvailable !== this.enabled) this.EnableMouseLock(MouseLockAvailable);
	}

	EnableMouseLock(enable: boolean) {
		if (enable !== this.enabled) {
			this.enabled = enable;

			if (this.enabled) {
				// Enabling the mode
				this.BindContextActions();
			} else {
				// Disabling
				// Restore mouse cursor
				CameraUtils.restoreMouseIcon();

				this.UnbindContextActions();

				// If the mode is disabled while being used, fire the event to toggle it off
				if (this.isMouseLocked) this.mouseLockToggledEvent.fire();

				this.isMouseLocked = false;
			}
		}
	}

	GetBindableToggleEvent() {
		return this.mouseLockToggledEvent;
	}

	GetIsMouseLocked() {
		return this.isMouseLocked;
	}

	GetMouseLockOffset() {
		if (FFlagUserFixCameraOffsetJitter) {
			return CAMERA_OFFSET_DEFAULT;
		} else {
			let offsetValueObj: Instance | Vector3Value | undefined = script.FindFirstChild("CameraOffset") as Vector3Value;

			if (offsetValueObj && offsetValueObj.IsA("Vector3Value")) {
				return offsetValueObj.Value;
			} else {
				// If CameraOffset object was found but not correct type, destroy
				offsetValueObj?.Destroy();

				offsetValueObj = new Instance("Vector3Value");

				assert(offsetValueObj && offsetValueObj.IsA("Vector3Value"));

				offsetValueObj.Name = "CameraOffset";
				offsetValueObj.Value = new Vector3(1.75, 0, 0); // Legacy Default Value
				offsetValueObj.Parent = script;
			}

			if (offsetValueObj && offsetValueObj.Value) return offsetValueObj.Value;

			return new Vector3(1.75, 0, 0);
		}
	}
}