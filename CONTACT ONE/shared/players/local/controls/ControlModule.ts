import { GuiService, Players, RunService, UserInputService, VRService, Workspace } from "@rbxts/services";
import { FlagUtil } from "CONTACT ONE/shared/players/local/FlagUtil";
import { Constructable } from "CORP/shared/Libraries/Utilities";
import { PlayerModule } from "../PlayerModule";
import { BaseCharacterController } from "./BaseCharacterController";
import { DynamicThumbstick } from "./DynamicThumbstick";
import { Gamepad } from "./Gamepad";
import { Keyboard } from "./Keyboard";
import { TouchJump } from "./TouchJump";

const FFlagUserDynamicThumbstickSafeAreaUpdate = FlagUtil.getUserFlag("UserDynamicThumbstickSafeAreaUpdate");

const CONTROL_ACTION_PRIORITY = Enum.ContextActionPriority.Medium.Value;
const NECK_OFFSET = -0.7;
const FIRST_PERSON_THRESHOLD_DISTANCE = 5;

const UserGameSettings = UserSettings().GetService("UserGameSettings");

// Mapping from movement mode && lastInputType enum values to control modules to avoid huge if ( } else if ( switching
const movementEnumToModuleMap = {
	[Enum.TouchMovementMode.DPad as never]: DynamicThumbstick,
	[Enum.DevTouchMovementMode.DPad as never]: DynamicThumbstick,
	[Enum.TouchMovementMode.Thumbpad as never]: DynamicThumbstick,
	[Enum.DevTouchMovementMode.Thumbpad as never]: DynamicThumbstick,
	// [Enum.TouchMovementMode.Thumbstick as never]: TouchThumbstick, TODO TOUCHTHUMBSTICK
	// [Enum.DevTouchMovementMode.Thumbstick as never]: TouchThumbstick, TODO TOUCHTHUMBSTICK
	[Enum.TouchMovementMode.DynamicThumbstick as never]: DynamicThumbstick,
	[Enum.DevTouchMovementMode.DynamicThumbstick as never]: DynamicThumbstick,
	// [Enum.TouchMovementMode.ClickToMove as never]: ClickToMove, TODO CLICKTOMOVE
	// [Enum.DevTouchMovementMode.ClickToMove as never]: ClickToMove, TODO CLICKTOMOVE

	// Current default
	[Enum.TouchMovementMode.Default as never]: DynamicThumbstick,

	[Enum.ComputerMovementMode.Default as never]: Keyboard,
	[Enum.ComputerMovementMode.KeyboardMouse as never]: Keyboard,
	[Enum.DevComputerMovementMode.KeyboardMouse as never]: Keyboard,
	[Enum.DevComputerMovementMode.Scriptable as never]: undefined,
	// [Enum.ComputerMovementMode.ClickToMove as never]: ClickToMove, TODO CLICKTOMOVE
	// [Enum.DevComputerMovementMode.ClickToMove as never]: ClickToMove, TODO CLICKTOMOVE
};

// Keyboard controller is really keyboard && mouse controller
const computerInputTypeToModuleMap = {
	[Enum.UserInputType.Keyboard as never]: Keyboard,
	[Enum.UserInputType.MouseButton1 as never]: Keyboard,
	[Enum.UserInputType.MouseButton2 as never]: Keyboard,
	[Enum.UserInputType.MouseButton3 as never]: Keyboard,
	[Enum.UserInputType.MouseWheel as never]: Keyboard,
	[Enum.UserInputType.MouseMovement as never]: Keyboard,
	[Enum.UserInputType.Gamepad1 as never]: Gamepad,
	[Enum.UserInputType.Gamepad2 as never]: Gamepad,
	[Enum.UserInputType.Gamepad3 as never]: Gamepad,
	[Enum.UserInputType.Gamepad4 as never]: Gamepad,
};

let lastInputType: Enum.UserInputType | undefined;

function NormalizeAngle(angle: number): number {
	angle = (angle + math.pi * 4) % (math.pi * 2);

	if (angle > math.pi) angle = angle - math.pi * 2;

	return angle;
}

function AverageAngle(angleA: number, angleB: number): number {
	const difference = NormalizeAngle(angleB - angleA);

	return NormalizeAngle(angleA + difference / 2);
}

function getGamepadRightThumbstickPosition(): Vector3 {
	const state = UserInputService.GetGamepadState(Enum.UserInputType.Gamepad1);
	return state.find(input => input.KeyCode === Enum.KeyCode.Thumbstick2)?.Position ?? Vector3.zero;
}

/**
	ControlModule - This ModuleScript implements a singleton class to manage the
	selection, activation, && deactivation of the current character movement controller.
	This script binds to RenderStepped at Input priority && calls the Update() methods
	on the active controller instances.

	The character controller ModuleScripts implement classes which are instantiated &&
	activated as-needed, they are no longer all instantiated up front as they were in
	the previous generation of PlayerScripts.

	2018 PlayerScripts Update - AllYourBlox
*/
export class ControlModule {
	/**
	 * The Modules above are used to construct controller instances as-needed, and this
	 * table is a map from Module to the instance created from it
	 */
	controllers = new Map<Constructable<BaseCharacterController>, BaseCharacterController>();

	activeControlModule: Constructable<BaseCharacterController> | undefined; // Used to prevent unnecessarily expensive checks on each input event
	activeController: BaseCharacterController | undefined;
	touchJumpController: TouchJump | undefined;
	moveFunction: ((player: Player, direction: Vector3, cameraRelative: boolean) => void) | undefined;
	humanoid: Humanoid | undefined;
	lastInputType: Enum.UserInputType = Enum.UserInputType.None;
	controlsEnabled = true;
	/**
	 * For Roblox this.vehicleController
	 */
	humanoidSeatedConn: RBXScriptConnection | undefined;
	// vehicleController: RBXVehicleController | undefined; // TODO VEHICLECONTROLLER

	touchControlFrame: Frame | undefined;
	currentTorsoAngle = 0;

	inputMoveVector = Vector3.zero;

	//[[ Touch Device UI ]]//
	playerGui: PlayerGui | undefined;
	touchGui: ScreenGui | undefined;
	playerGuiAddedConn: RBXScriptConnection | undefined;

	private playerModule: PlayerModule;

	constructor(playerModule: PlayerModule) {
		this.playerModule = playerModule;

		Players.LocalPlayer.CharacterAdded.Connect((char) => this.OnCharacterAdded(char));
		Players.LocalPlayer.CharacterRemoving.Connect((char) => this.OnCharacterRemoving(char));

		if (Players.LocalPlayer.Character) this.OnCharacterAdded(Players.LocalPlayer.Character);

		RunService.BindToRenderStep("ControlScriptRenderstep", Enum.RenderPriority.Input.Value, dt => this.OnRenderStepped(dt));

		UserInputService.LastInputTypeChanged.Connect(newLastInputType => this.OnLastInputTypeChanged(newLastInputType));

		UserGameSettings.GetPropertyChangedSignal("TouchMovementMode").Connect(() => this.OnTouchMovementModeChange());
		Players.LocalPlayer.GetPropertyChangedSignal("DevTouchMovementMode").Connect(() => this.OnTouchMovementModeChange());

		UserGameSettings.GetPropertyChangedSignal("ComputerMovementMode").Connect(() => this.OnComputerMovementModeChange());

		Players.LocalPlayer.GetPropertyChangedSignal("DevComputerMovementMode").Connect(() => this.OnComputerMovementModeChange());

		GuiService.GetPropertyChangedSignal("TouchControlsEnabled").Connect(() => {
			this.UpdateTouchGuiVisibility();
			this.UpdateActiveControlModuleEnabled();
		});

		if (UserInputService.TouchEnabled) {
			this.playerGui = Players.LocalPlayer.FindFirstChildOfClass("PlayerGui");

			if (this.playerGui) {
				this.CreateTouchGuiContainer();
				this.OnLastInputTypeChanged(UserInputService.GetLastInputType());
			} else {
				this.playerGuiAddedConn = Players.LocalPlayer.ChildAdded.Connect((child) => {
					if (child.IsA("PlayerGui")) {
						this.playerGui = child;

						this.CreateTouchGuiContainer();

						this.playerGuiAddedConn?.Disconnect();
						this.playerGuiAddedConn = undefined;

						this.OnLastInputTypeChanged(UserInputService.GetLastInputType());
					}
				});
			}
		} else {
			this.OnLastInputTypeChanged(UserInputService.GetLastInputType());
		}
	}

	// Convenience function so that calling code does !have to first get the activeController
	// && ){ call GetMoveVector on it. When there is no active controller, this function returns the
	// zero vector
	GetMoveVector(): Vector3 {
		return this.activeController?.GetMoveVector() ?? Vector3.zero;
	}

	GetEstimatedVRTorsoFrame(): CFrame {
		const headFrame = VRService.GetUserCFrame(Enum.UserCFrame.Head);
		// eslint-disable-next-line prefer-const
		let [__, headAngle, ___] = headFrame.ToEulerAnglesYXZ();

		headAngle = -headAngle;

		if (!VRService.GetUserCFrameEnabled(Enum.UserCFrame.RightHand) ||
			!VRService.GetUserCFrameEnabled(Enum.UserCFrame.LeftHand)) {
			this.currentTorsoAngle = headAngle;
		} else {
			const leftHandPos = VRService.GetUserCFrame(Enum.UserCFrame.LeftHand);
			const rightHandPos = VRService.GetUserCFrame(Enum.UserCFrame.RightHand);

			const leftHandToHead = headFrame.Position.sub(leftHandPos.Position);
			const rightHandToHead = headFrame.Position.sub(rightHandPos.Position);
			const leftHandAngle = -math.atan2(leftHandToHead.X, leftHandToHead.Z);
			const rightHandAngle = -math.atan2(rightHandToHead.X, rightHandToHead.Z);
			const averageHandAngle = AverageAngle(leftHandAngle, rightHandAngle);

			const headAngleRelativeToCurrentAngle = NormalizeAngle(headAngle - this.currentTorsoAngle);

			let averageHandAngleRelativeToCurrentAngle = NormalizeAngle(averageHandAngle - this.currentTorsoAngle);

			const averageHandAngleValid =
				averageHandAngleRelativeToCurrentAngle > -math.pi / 2 &&
				averageHandAngleRelativeToCurrentAngle < math.pi / 2;

			if (!averageHandAngleValid) {
				averageHandAngleRelativeToCurrentAngle = headAngleRelativeToCurrentAngle;
			}

			const minimumValidAngle = math.min(averageHandAngleRelativeToCurrentAngle, headAngleRelativeToCurrentAngle);
			const maximumValidAngle = math.max(averageHandAngleRelativeToCurrentAngle, headAngleRelativeToCurrentAngle);

			let relativeAngleToUse = 0;

			if (minimumValidAngle > 0) {
				relativeAngleToUse = minimumValidAngle;
			} else if (maximumValidAngle < 0) {
				relativeAngleToUse = maximumValidAngle;
			}

			this.currentTorsoAngle = relativeAngleToUse + this.currentTorsoAngle;
		}

		return new CFrame(headFrame.Position).mul(CFrame.fromEulerAnglesYXZ(0, -this.currentTorsoAngle, 0));
	}

	GetActiveController() {
		return this.activeController;
	}

	// Checks for conditions for enabling/disabling the active controller && updates whether the active controller is enabled/disabled
	UpdateActiveControlModuleEnabled() {
		// helpers for disable/enable
		const disable = () => {
			this.activeController?.Enable(false);

			if (this.touchJumpController) this.touchJumpController.Enable(false);
			if (this.moveFunction) this.moveFunction(Players.LocalPlayer, Vector3.zero, true);
		};

		const enable = () => {
			if (
				this.touchControlFrame
				&& (
					/*this.activeControlModule === ClickToMove
					|| this.activeControlModule === TouchThumbstick // TODO CLICKTOMOVE TOUCHTHUMBSTICK
					|| */this.activeControlModule === DynamicThumbstick
				)
			) {
				if (!this.controllers.has(TouchJump)) this.controllers.set(TouchJump, new TouchJump(this.playerModule));

				this.touchJumpController = this.controllers.get(TouchJump) as TouchJump;
				this.touchJumpController.Enable(true, this.touchControlFrame);
			} else {
				if (this.touchJumpController) {
					this.touchJumpController.Enable(false);
				}
			}

			assert(this.activeController);

			/*if (this.activeControlModule === ClickToMove) {
				// For ClickToMove, when it is the player's choice, we also enable the full keyboard controls.
				// When the developer is forcing click to move, the most keyboard controls (WASD) are !available, only jump.
				this.activeController.Enable(
					true,
					Players.LocalPlayer.DevComputerMovementMode === Enum.DevComputerMovementMode.UserChoice,
					this.touchJumpController
				);
			} else */if (this.touchControlFrame) {
				this.activeController.Enable(true, this.touchControlFrame);
			} else {
				this.activeController.Enable(true);
			}
		};

		// there is no active controller
		if (!this.activeController) {
			return;
		}

		// developer called ControlModule.Disable(), don't turn back on
		if (!this.controlsEnabled) {
			disable();
			return;
		}

		// GuiService.TouchControlsEnabled ===false && the active controller is a touch controller,
		// disable controls
		if (!GuiService.TouchControlsEnabled && UserInputService.TouchEnabled &&
			(/*this.activeControlModule === ClickToMove || this.activeControlModule === TouchThumbstick ||*/
				this.activeControlModule === DynamicThumbstick)) { // TODO CLICKTOMOVE TOUCHTHUMBSTICK
			disable();
			return;
		}

		// no settings prevent enabling controls
		enable();
	}

	Enable(enable?: boolean) {
		if (enable === undefined) {
			enable = true;
		}
		this.controlsEnabled = enable;

		if (!this.activeController) {
			return;
		}

		this.UpdateActiveControlModuleEnabled();
	}

	// For those who prefer distinct functions
	Disable() {
		this.controlsEnabled = false;

		this.UpdateActiveControlModuleEnabled();
	}


	// Returns module (possibly undefined) && success code to differentiate returning undefined due to error vs Scriptable
	SelectComputerMovementModule(): [Constructable<BaseCharacterController> | undefined, boolean] {
		if (!(UserInputService.KeyboardEnabled || UserInputService.GamepadEnabled)) {
			return [undefined, false];
		}

		let computerModule: Constructable<BaseCharacterController> | undefined;

		const DevMovementMode = Players.LocalPlayer.DevComputerMovementMode;

		if (DevMovementMode === Enum.DevComputerMovementMode.UserChoice) {
			computerModule = computerInputTypeToModuleMap[lastInputType as never];
			// User has ClickToMove set in Settings, prefer ClickToMove controller for keyboard && mouse lastInputTypes
			// if (UserGameSettings.ComputerMovementMode === Enum.ComputerMovementMode.ClickToMove && computerModule === Keyboard) computerModule = ClickToMove; // TODO CLICKTOMOVE
		} else {
			// Developer has selected a mode that must be used.
			computerModule = movementEnumToModuleMap[DevMovementMode as never] as Constructable<BaseCharacterController>;

			// computerModule is expected to be undefined here only when developer has selected Scriptable
			if ((!computerModule) && DevMovementMode !== Enum.DevComputerMovementMode.Scriptable) {
				warn("No character control module is associated with DevComputerMovementMode ", DevMovementMode);
			}
		}

		if (computerModule) {
			return [computerModule, true];
		} else if (DevMovementMode === Enum.DevComputerMovementMode.Scriptable) {
			// Special case where undefined is returned && we actually want to set this.activeController to undefined for Scriptable
			return [undefined, true];
		} else {
			// This case is for when computerModule is undefined because of an error && no suitable control module could
			// be found.
			return [undefined, false];
		}
	}

	// Choose current Touch control module based on settings (user, dev)
	// Returns module (possibly undefined) && success code to differentiate returning undefined due to error vs Scriptable
	SelectTouchModule(): [Constructable<BaseCharacterController> | undefined, boolean] {
		if (!UserInputService.TouchEnabled) {
			return [undefined, false];
		}

		let touchModule;
		const DevMovementMode = Players.LocalPlayer.DevTouchMovementMode;

		if (DevMovementMode === Enum.DevTouchMovementMode.UserChoice) {
			touchModule = movementEnumToModuleMap[UserGameSettings.TouchMovementMode as never];
		} else if (DevMovementMode === Enum.DevTouchMovementMode.Scriptable) {
			return [undefined, true];
		} else {
			touchModule = movementEnumToModuleMap[DevMovementMode as never];
		}

		return [touchModule, true];
	}

	calculateRawMoveVector(humanoid: Humanoid, cameraRelativeMoveVector: Vector3): Vector3 {
		const camera = Workspace.CurrentCamera;

		if (!camera) return cameraRelativeMoveVector;

		let cameraCFrame = camera.CFrame;

		if (VRService.VREnabled && humanoid.RootPart) {
			let vrFrame = VRService.GetUserCFrame(Enum.UserCFrame.Head);

			vrFrame = this.GetEstimatedVRTorsoFrame();

			// movement relative to VR frustum
			const cameraDelta = camera.Focus.Position.sub(cameraCFrame.Position);

			if (cameraDelta.Magnitude < 3) { // "nearly" first person
				cameraCFrame = cameraCFrame.mul(vrFrame);
			} else {
				cameraCFrame = camera.CFrame.mul(vrFrame.Rotation.add(vrFrame.Position.mul(camera.HeadScale)));
			}
		}

		if (humanoid.GetState() === Enum.HumanoidStateType.Swimming) {
			if (VRService.VREnabled) {
				cameraRelativeMoveVector = new Vector3(cameraRelativeMoveVector.X, 0, cameraRelativeMoveVector.Z);
				if (cameraRelativeMoveVector.Magnitude < 0.01) {
					return Vector3.zero;
				}

				const pitch = -getGamepadRightThumbstickPosition().Y * math.rad(80);
				let yawAngle = math.atan2(-cameraRelativeMoveVector.X, -cameraRelativeMoveVector.Z);
				const [__, cameraYaw, ___] = cameraCFrame.ToEulerAnglesYXZ();

				yawAngle += cameraYaw;

				const movementCFrame = CFrame.fromEulerAnglesYXZ(pitch, yawAngle, 0);

				return movementCFrame.LookVector;
			} else {
				return cameraCFrame.VectorToWorldSpace(cameraRelativeMoveVector);
			}
		}

		let c, s;
		const [__, ___, ____, R00, R01, R02, _____, ______, R12, _______, ________, R22] = cameraCFrame.GetComponents();

		if (R12 < 1 && R12 > -1) {
			// X && Z components from back vector.
			c = R22;
			s = R02;
		} else {
			// In this case the camera is looking straight up or straight down.
			// Use X components from right && up vectors.
			c = R00;
			s = -R01 * math.sign(R12);
		}

		const norm = math.sqrt(c * c + s * s);

		return new Vector3(
			(c * cameraRelativeMoveVector.X + s * cameraRelativeMoveVector.Z) / norm,
			0,
			(c * cameraRelativeMoveVector.Z - s * cameraRelativeMoveVector.X) / norm
		);
	}

	OnRenderStepped(dt: number) {
		if (this.activeController && this.activeController.enabled && this.humanoid) {

			// Now retrieve info from the controller
			let moveVector = this.activeController.GetMoveVector();

			const cameraRelative = this.activeController.IsMoveVectorCameraRelative();

			/*
			const clickToMoveController = this.GetClickToMoveController();

			if (this.activeController === clickToMoveController) {
				clickToMoveController.OnRenderStepped(dt);
			} else {
				if (moveVector.Magnitude > 0) {
					// Clean up any developer started MoveTo path
					clickToMoveController.CleanupPath();
				} else {
					// Get move vector for developer started MoveTo
					clickToMoveController.OnRenderStepped(dt);
					moveVector = clickToMoveController.GetMoveVector();
					cameraRelative = clickToMoveController.IsMoveVectorCameraRelative();
				}
			}
			*/ // TODO CLICKTOMOVE

			// Are we driving a vehicle ?
			/*
			let vehicleConsumedInput = false;

			if (this.vehicleController) [moveVector, vehicleConsumedInput] = this.vehicleController.Update(moveVector, cameraRelative, this.activeControlModule === Gamepad);*/ // TODO VEHICLECONTROLLER

			// If not, move the player
			// Verification of vehicleConsumedInput is commented out to preserve legacy behavior,
			// in case some game relies on Humanoid.MoveDirection still being set while in a VehicleSeat
			//if (!vehicleConsumedInput) {
			if (cameraRelative) moveVector = this.calculateRawMoveVector(this.humanoid, moveVector);

			this.inputMoveVector = moveVector;
			if (VRService.VREnabled) {
				moveVector = this.updateVRMoveVector(moveVector);
			}

			if (this.moveFunction) this.moveFunction(Players.LocalPlayer, moveVector, false);
			//}

			// && make them jump if ( needed
			this.humanoid.Jump = this.activeController.GetIsJumping() || (this.touchJumpController && this.touchJumpController.GetIsJumping()) || false;
		}
	}

	updateVRMoveVector(moveVector: Vector3) {
		const curCamera = Workspace.CurrentCamera as Camera;

		// movement relative to VR frustum
		const cameraDelta = curCamera.Focus.Position.sub(curCamera.CFrame.Position);
		const firstPerson = cameraDelta.Magnitude < FIRST_PERSON_THRESHOLD_DISTANCE && true;

		// if ( the player is !moving via input in first person, follow the VRHead
		if (moveVector.Magnitude === 0 && firstPerson && VRService.AvatarGestures && this.humanoid
			&& !this.humanoid.Sit) {

			assert(this.humanoid.RootPart);

			let vrHeadOffset = VRService.GetUserCFrame(Enum.UserCFrame.Head);

			vrHeadOffset = vrHeadOffset.Rotation.add(vrHeadOffset.Position.mul(curCamera.HeadScale));

			// get the position in world space && offset at the neck
			const neck_offset = NECK_OFFSET * this.humanoid.RootPart.Size.Y / 2;
			const vrHeadWorld = curCamera.CFrame.mul(vrHeadOffset).mul(new CFrame(0, neck_offset, 0));

			const moveOffset = vrHeadWorld.Position.sub(this.humanoid.RootPart.CFrame.Position);

			return new Vector3(moveOffset.X, 0, moveOffset.Z);
		}

		return moveVector;
	}

	OnHumanoidSeated(active: boolean, currentSeatPart: BasePart | undefined) {
		/* if (active) {
			if (currentSeatPart && currentSeatPart.IsA("VehicleSeat")) {
				if (!this.vehicleController) this.vehicleController = this.vehicleController.new(CONTROL_ACTION_PRIORITY);

				this.vehicleController.Enable(true, currentSeatPart);
			}
		} else {
			if (this.vehicleController) this.vehicleController.Enable(false, currentSeatPart);
		}*/ // TODO VEHICLECONTROLLER
	}

	OnCharacterAdded(char: Model) {
		this.humanoid = char.FindFirstChildOfClass("Humanoid");

		while (!this.humanoid) {
			char.ChildAdded.Wait();

			this.humanoid = char.FindFirstChildOfClass("Humanoid");
		}

		this.UpdateTouchGuiVisibility();

		if (this.humanoidSeatedConn) {
			this.humanoidSeatedConn.Disconnect();
			this.humanoidSeatedConn = undefined;
		}

		this.humanoidSeatedConn = this.humanoid.Seated.Connect((active, currentSeatPart) => {
			this.OnHumanoidSeated(active, currentSeatPart);
		});
	}

	OnCharacterRemoving(char: Model) {
		this.humanoid = undefined;

		this.UpdateTouchGuiVisibility();
	}

	UpdateTouchGuiVisibility() {
		if (this.touchGui) {
			const doShow = this.humanoid && GuiService.TouchControlsEnabled;
			this.touchGui.Enabled = !!doShow; // convert to bool
		}
	}

	// Helper function to lazily instantiate a controller if it does not yet exist,
	// disable the active controller if it is different from the on being switched to,
	// and then enable the requested controller. The argument to this function must be
	// a reference to one of the control modules, i.e. Keyboard, Gamepad, etc.

	// This function should handle all controller enabling and disabling without relying on
	// ControlModule:Enable() and Disable()
	SwitchToController(controlModule: Constructable<BaseCharacterController>) {
		// controlModule is invalid, just disable current controller
		if (!controlModule) {
			if (this.activeController) this.activeController.Enable(false);

			this.activeController = undefined;
			this.activeControlModule = undefined;

			return;
		}

		// first time switching to this control module, should instantiate it
		if (!this.controllers.has(controlModule)) this.controllers.set(controlModule, new controlModule(this.playerModule, CONTROL_ACTION_PRIORITY));

		// switch to the new controlModule
		if (this.activeController !== this.controllers.get(controlModule)) {
			if (this.activeController) this.activeController.Enable(false);

			this.activeController = this.controllers.get(controlModule);
			this.activeControlModule = controlModule; // Only used to check if controller switch is necessary

			this.UpdateActiveControlModuleEnabled();
		}
	}

	OnLastInputTypeChanged(newLastInputType = lastInputType) {
		if (lastInputType === newLastInputType) {
			warn("LastInputType Change listener called with current type.");
		}

		lastInputType = newLastInputType;

		if (lastInputType === Enum.UserInputType.Touch) {
			// TODO: Check if ( touch module already active
			const [touchModule, success] = this.SelectTouchModule();

			if (success) {
				while (!this.touchControlFrame) task.wait();

				this.SwitchToController(touchModule as Constructable<BaseCharacterController>);
			}
		} else if (computerInputTypeToModuleMap[lastInputType as never] !== undefined) {
			const [computerModule] = this.SelectComputerMovementModule();

			if (computerModule) {
				this.SwitchToController(computerModule);
			}
		}

		this.UpdateTouchGuiVisibility();
	}

	// Called when any relevant values of GameSettings or LocalPlayer change, forcing re-evalulation of
	// current control scheme
	OnComputerMovementModeChange() {
		const [controlModule, success] = this.SelectComputerMovementModule();

		if (success) {
			this.SwitchToController(controlModule as Constructable<BaseCharacterController>);
		}
	}

	OnTouchMovementModeChange() {
		const [touchModule, success] = this.SelectTouchModule();

		if (success) {
			while (!this.touchControlFrame) {
				wait();
			}
			this.SwitchToController(touchModule as Constructable<BaseCharacterController>);
		}
	}

	CreateTouchGuiContainer() {
		if (this.touchGui) { this.touchGui.Destroy(); }

		// Container for all touch device guis
		this.touchGui = new Instance("ScreenGui");
		this.touchGui.Name = "TouchGui";
		this.touchGui.ResetOnSpawn = false;
		this.touchGui.ZIndexBehavior = Enum.ZIndexBehavior.Sibling;

		this.UpdateTouchGuiVisibility();

		if (FFlagUserDynamicThumbstickSafeAreaUpdate) {
			this.touchGui.ClipToDeviceSafeArea = false;
		}

		this.touchControlFrame = new Instance("Frame");

		this.touchControlFrame.Name = "TouchControlFrame";
		this.touchControlFrame.Size = new UDim2(1, 0, 1, 0);
		this.touchControlFrame.BackgroundTransparency = 1;
		this.touchControlFrame.Parent = this.touchGui;

		this.touchGui.Parent = this.playerGui;
	}

	GetClickToMoveController() {
		/*if (!this.controllers.has(ClickToMove)) {
			this.controllers.set(ClickToMove, new ClickToMove(CONTROL_ACTION_PRIORITY));
		}

		return this.controllers.get(ClickToMove);*/ // TODO CLICKTOMOVE
	}
}