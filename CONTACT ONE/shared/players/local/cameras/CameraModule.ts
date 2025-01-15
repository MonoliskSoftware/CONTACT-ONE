import { Players, RunService, UserInputService, VRService, Workspace } from "@rbxts/services";
import { Constructable, dict } from "CORP/shared/Libraries/Utilities";
import { FlagUtil } from "../FlagUtil";
import { BaseCamera } from "./BaseCamera";
import { BaseOcclusion } from "./BaseOcclusion";
import { CameraInput } from "./CameraInput";
import { CameraUtils } from "./CameraUtils";
import { ClassicCamera } from "./ClassicCamera";
import { MouseLockController } from "./MouseLockController";
import { OrbitalCamera } from "./OrbitalCamera";
import { Poppercam } from "./Poppercam";
import { TransparencyController } from "./TransparencyController";

const UserGameSettings = UserSettings().GetService("UserGameSettings");

// NOTICE: Player property names do not all match their StarterPlayer equivalents,
// with the differences noted in the comments on the right
const PLAYER_CAMERA_PROPERTIES =
	[
		"CameraMinZoomDistance",
		"CameraMaxZoomDistance",
		"CameraMode",
		"DevCameraOcclusionMode",
		"DevComputerCameraMode",			// Corresponds to StarterPlayer.DevComputerCameraMovementMode
		"DevTouchCameraMode",				// Corresponds to StarterPlayer.DevTouchCameraMovementMode

		// Character movement mode
		"DevComputerMovementMode",
		"DevTouchMovementMode",
		"DevEnableMouseLock",				// Corresponds to StarterPlayer.EnableMouseLockOption
	];

const USER_GAME_SETTINGS_PROPERTIES =
	[
		"ComputerCameraMovementMode",
		"ComputerMovementMode",
		"ControlMode",
		"GamepadCameraSensitivity",
		"MouseSensitivity",
		"RotationType",
		"TouchCameraMovementMode",
		"TouchMovementMode",
	];

const FFlagUserRespectLegacyCameraOptions = FlagUtil.getUserFlag("UserRespectLegacyCameraOptions");

/**
 * CameraModule - This ModuleScript implements a singleton class to manage the
	selection, activation, and deactivation of the current camera controller,
	character occlusion controller, and transparency controller. This script binds to
	RenderStepped at Camera priority and calls the Update() methods on the active
	controller instances.

	The camera controller ModuleScripts implement classes which are instantiated and
	activated as-needed, they are no longer all instantiated up front as they were in
	the previous generation of PlayerScripts.

	2018 PlayerScripts Update - AllYourBlox
 * 
 */
export class CameraModule {
	// Table of camera controllers that have been instantiated. They are instantiated as they are used.
	private static readonly instantiatedCameraControllers = new Map<Constructable<BaseCamera>, BaseCamera>();
	private static readonly instantiatedOcclusionModules = new Map<Constructable<BaseOcclusion>, BaseOcclusion>();

	// Current active controller instances
	activeCameraController: BaseCamera | undefined;
	
	private activeOcclusionModule: BaseOcclusion | undefined;
	private activeTransparencyController: TransparencyController | undefined;
	private activeMouseLockController: MouseLockController | undefined;

	// private currentComputerCameraMovementMode Not used anywhere else in defs

	// Connections to events
	private cameraSubjectChangedConn: RBXScriptConnection | undefined;
	private cameraTypeChangedConn: RBXScriptConnection | undefined;

	// Other properties
	private occlusionMode: Enum.DevCameraOcclusionMode | undefined;

	constructor() {
		// Management of which options appear on the Roblox User Settings screen
		{
			const PlayerScripts = Players.LocalPlayer.WaitForChild("PlayerScripts") as PlayerScripts;

			PlayerScripts.RegisterTouchCameraMovementMode(Enum.TouchCameraMovementMode.Default);
			PlayerScripts.RegisterTouchCameraMovementMode(Enum.TouchCameraMovementMode.Follow);
			PlayerScripts.RegisterTouchCameraMovementMode(Enum.TouchCameraMovementMode.Classic);

			PlayerScripts.RegisterComputerCameraMovementMode(Enum.ComputerCameraMovementMode.Default);
			PlayerScripts.RegisterComputerCameraMovementMode(Enum.ComputerCameraMovementMode.Follow);
			PlayerScripts.RegisterComputerCameraMovementMode(Enum.ComputerCameraMovementMode.Classic);
			PlayerScripts.RegisterComputerCameraMovementMode(Enum.ComputerCameraMovementMode.CameraToggle);
		}

		// Adds CharacterAdded and CharacterRemoving event handlers for all current players
		Players.GetPlayers().forEach(player => this.OnPlayerAdded(player));

		// Adds CharacterAdded and CharacterRemoving event handlers for all players who join in the future
		Players.PlayerAdded.Connect(player => this.OnPlayerAdded(player));

		this.activeTransparencyController = new TransparencyController();
		this.activeTransparencyController.Enable(true);

		if (UserInputService.MouseEnabled) {
			this.activeMouseLockController = new MouseLockController();
			this.activeMouseLockController.GetBindableToggleEvent()?.Connect(() => this.OnMouseLockToggled());
		}

		if (FFlagUserRespectLegacyCameraOptions) {
			this.ActivateCameraController();
		} else {
			this.ActivateCameraController(this.GetCameraControlChoice());
		}

		this.ActivateOcclusionModule(Players.LocalPlayer.DevCameraOcclusionMode);
		this.OnCurrentCameraChanged(); // Does initializations and makes first camera controller

		RunService.BindToRenderStep("cameraRenderUpdate", Enum.RenderPriority.Camera.Value, (deltaTime: number) => this.Update(deltaTime));

		// Connect listeners to camera-related properties
		PLAYER_CAMERA_PROPERTIES.forEach(prop => Players.LocalPlayer.GetPropertyChangedSignal(prop as InstancePropertyNames<Player>).Connect(() => this.OnLocalPlayerCameraPropertyChanged(prop)));

		USER_GAME_SETTINGS_PROPERTIES.forEach(prop => UserGameSettings.GetPropertyChangedSignal(prop as InstancePropertyNames<UserGameSettings>).Connect(() => this.OnUserGameSettingsPropertyChanged(prop)));

		Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(() => this.OnCurrentCameraChanged());
	}

	OnPlayerAdded(player: Player): void {
		player.CharacterAdded.Connect(char => this.OnCharacterAdded(char, player));
		player.CharacterRemoving.Connect(char => this.OnCharacterRemoving(char, player));
	}

	OnCharacterAdded(char: Model, player: Player): void {
		if (this.activeOcclusionModule) this.activeOcclusionModule.CharacterAdded(char, player);
	}

	OnCharacterRemoving(char: Model, player: Player): void {
		if (this.activeOcclusionModule) this.activeOcclusionModule.CharacterRemoving(char, player);
	}

	OnMouseLockToggled() {
		if (this.activeMouseLockController && this.activeCameraController) {
			const mouseLocked = this.activeMouseLockController.GetIsMouseLocked();
			const mouseLockOffset = this.activeMouseLockController.GetMouseLockOffset();

			this.activeCameraController.SetIsMouseLocked(mouseLocked);
			this.activeCameraController.SetMouseLockOffset(mouseLockOffset);
		}
	}

	/**
	 * remove args with FFlagUserRespectLegacyCameraOptions
	 */
	ActivateCameraController(cameraMovementMode?: CameraUtils.StandardizedMovementModes, legacyCameraType?: Enum.CameraType) {
		if (FFlagUserRespectLegacyCameraOptions) {
			// legacyCameraType should always be respected
			legacyCameraType = (Workspace.CurrentCamera as Camera).CameraType;
			cameraMovementMode = this.GetCameraMovementModeFromSettings();
		}

		let newCameraCreator: Constructable<BaseCamera> = undefined as unknown as Constructable<BaseCamera>;

		// Some legacy CameraTypes map to the use of
		// the LegacyCamera module, the value "Custom" will be translated to a movementMode enum
		// value based on Dev and User settings, and "Scriptable" will disable the camera controller.
		if (FFlagUserRespectLegacyCameraOptions ? true : legacyCameraType !== undefined) {
			if (legacyCameraType === Enum.CameraType.Scriptable) {
				if (this.activeCameraController) {
					this.activeCameraController.Enable(false);
					this.activeCameraController = undefined;
				}
				return;
			} else if (legacyCameraType === Enum.CameraType.Custom) {
				cameraMovementMode = this.GetCameraMovementModeFromSettings();
			} else if (legacyCameraType === Enum.CameraType.Track) {
				// Note. The TrackCamera module was basically an older, less fully-featured
				// version of ClassicCamera, no longer actively maintained, but it is re-implemented in
				// case a game was dependent on its lack of ClassicCamera's extra functionality.
				cameraMovementMode = Enum.ComputerCameraMovementMode.Classic;
			} else if (legacyCameraType === Enum.CameraType.Follow) {
				cameraMovementMode = Enum.ComputerCameraMovementMode.Follow;
			} else if (legacyCameraType === Enum.CameraType.Orbital) {
				cameraMovementMode = Enum.ComputerCameraMovementMode.Orbital;
			} else if (
				legacyCameraType === Enum.CameraType.Attach
				|| legacyCameraType === Enum.CameraType.Watch
				|| legacyCameraType === Enum.CameraType.Fixed) {
				// newCameraCreator = LegacyCamera;
				print("LegacyCamera");
			} else {
				warn("CameraScript encountered an unhandled Camera.CameraType value. ", legacyCameraType);
			}
		}

		if (!newCameraCreator) {
			if (VRService.VREnabled) {
				// newCameraCreator = VRCamera;
				print("VRCamera");
			} else if (cameraMovementMode === Enum.ComputerCameraMovementMode.Classic ||
				cameraMovementMode === Enum.ComputerCameraMovementMode.Follow ||
				cameraMovementMode === Enum.ComputerCameraMovementMode.Default ||
				cameraMovementMode === Enum.ComputerCameraMovementMode.CameraToggle) {
				newCameraCreator = ClassicCamera;
				print("ClassicCamera");
			} else if (cameraMovementMode === Enum.ComputerCameraMovementMode.Orbital) {
				newCameraCreator = OrbitalCamera;
				print("OrbitalCamera");
			} else {
				warn("ActivateCameraController did not select a module.");
				return;
			}
		}

		const isVehicleCamera = this.ShouldUseVehicleCamera();

		if (isVehicleCamera) {
			if (VRService.VREnabled) {
				// newCameraCreator = VRVehicleCamera;
				print("VRVehicleCamera");
			} else {
				// newCameraCreator = VehicleCamera;
				print("VehicleCamera");
			}
		}

		// Create the camera control module we need if it does not already exist in instantiatedCameraControllers
		let newCameraController: BaseCamera = undefined as unknown as BaseCamera;

		if (!CameraModule.instantiatedCameraControllers.has(newCameraCreator)) {
			newCameraController = new newCameraCreator();
			CameraModule.instantiatedCameraControllers.set(newCameraCreator, newCameraController);
		} else {
			newCameraController = CameraModule.getInstantiatedCameraController(newCameraCreator) as BaseCamera;

			if (typeIs((newCameraController as dict).Reset, "function")) {
				((newCameraController as dict).Reset as Callback)();
			}
		}

		if (this.activeCameraController) {
			// deactivate the old controller and activate the new one
			if (this.activeCameraController !== newCameraController) {
				this.activeCameraController.Enable(false);
				this.activeCameraController = newCameraController;
				this.activeCameraController.Enable(true);
			} else if (!this.activeCameraController.GetEnabled()) {
				this.activeCameraController.Enable(true);
			}
		} else if (newCameraController !== undefined) {
			// only activate the new controller
			this.activeCameraController = newCameraController;
			this.activeCameraController.Enable(true);
		}

		if (this.activeCameraController) {
			if (FFlagUserRespectLegacyCameraOptions) {
				// These functions can be removed in the future and the logic of managing cameraType/cameraMovementMode should be moved
				// into a higher level class so that activeCameraControllers can be single function.
				this.activeCameraController.SetCameraMovementMode(cameraMovementMode as CameraUtils.StandardizedMovementModes);
				// was convertible to a ComputerCameraMovementMode value, i.e. really only applies to LegacyCamera
				this.activeCameraController.SetCameraType(legacyCameraType);
			} else {
				if (cameraMovementMode !== undefined) {
					this.activeCameraController.SetCameraMovementMode(cameraMovementMode);
				} else if (legacyCameraType !== undefined) {
					// Note that this is only called when legacyCameraType is not a type that
					// was convertible to a ComputerCameraMovementMode value, i.e. really only applies to LegacyCamera
					this.activeCameraController.SetCameraType(legacyCameraType);
				}
			}
		}
	}

	ShouldUseVehicleCamera(): boolean {
		const camera = Workspace.CurrentCamera;

		if (!camera) return false;

		const cameraType = camera.CameraType;
		const cameraSubject = camera.CameraSubject;

		const isEligibleType = cameraType === Enum.CameraType.Custom || cameraType === Enum.CameraType.Follow;
		const isEligibleSubject = cameraSubject ? cameraSubject.IsA("VehicleSeat") : false;
		const isEligibleOcclusionMode = this.occlusionMode !== Enum.DevCameraOcclusionMode.Invisicam;

		return isEligibleType && isEligibleSubject && isEligibleOcclusionMode;
	}

	/**
	 * Formerly getCurrentCameraMode, this function resolves developer and user camera control settings to
	 * decide which camera control module should be instantiated. The old method of converting redundant enum types
	 */
	GetCameraControlChoice(): Enum.ComputerCameraMovementMode | Enum.DevComputerCameraMovementMode | undefined {
		if (FFlagUserRespectLegacyCameraOptions) {
			const player = Players.LocalPlayer;

			if (player) {
				if (UserInputService.GetLastInputType() === Enum.UserInputType.Touch || UserInputService.TouchEnabled) {
					// Touch
					if (player.DevTouchCameraMode === Enum.DevTouchCameraMovementMode.UserChoice) {
						return CameraUtils.ConvertCameraModeEnumToStandard(UserGameSettings.TouchCameraMovementMode);
					} else {
						return CameraUtils.ConvertCameraModeEnumToStandard(player.DevTouchCameraMode);
					}
				} else {
					// Computer
					if (player.DevTouchCameraMode === Enum.DevComputerCameraMovementMode.UserChoice) {
						const computerMovementMode = CameraUtils.ConvertCameraModeEnumToStandard(UserGameSettings.ComputerCameraMovementMode);

						return CameraUtils.ConvertCameraModeEnumToStandard(computerMovementMode);
					} else {
						return CameraUtils.ConvertCameraModeEnumToStandard(player.DevComputerCameraMode);
					}
				}
			}
		}
	}

	public ActivateOcclusionModule(occlusionMode: Enum.DevCameraOcclusionMode) {
		let newModuleCreator: Constructable<BaseOcclusion> = undefined as unknown as Constructable<BaseOcclusion>;

		switch (occlusionMode) {
			case Enum.DevCameraOcclusionMode.Zoom:
				newModuleCreator = Poppercam;
				break;
			case Enum.DevCameraOcclusionMode.Invisicam:
				// newModuleCreator = Invisicam;
				break;
			default:
				warn("CameraScript ActivateOcclusionModule called with unsupported mode");
		}

		this.occlusionMode = occlusionMode;

		// First check to see if there is actually a change. If the module being requested is already
		// the currently-active solution { just make sure it's enabled and exit early
		if (this.activeOcclusionModule && this.activeOcclusionModule.GetOcclusionMode() === occlusionMode) {
			error(`Reached a supposedly unreachable condition`);
			// if (!this.activeOcclusionModule.GetEnabled()) {
			// 	this.activeOcclusionModule.Enable(true);
			// }

			// return;
		}

		// Save a reference to the current active module (may be nil) so that we can disable it if
		// we are successful in activating its replacement
		const prevOcclusionModule = this.activeOcclusionModule;

		// If there is no active module, see if the one we need has already been instantiated
		this.activeOcclusionModule = CameraModule.getInstantiatedOcclusionModule(newModuleCreator);

		// If the module was not already instantiated and selected above, instantiate it
		if (!this.activeOcclusionModule) {
			this.activeOcclusionModule = new newModuleCreator();

			if (this.activeOcclusionModule) CameraModule.instantiatedOcclusionModules.set(newModuleCreator, this.activeOcclusionModule);
		}

		// If we were successful in either selecting or instantiating the module,
		// enable it if it's not already the currently-active enabled module
		if (this.activeOcclusionModule) {
			const newModuleOcclusionMode = this.activeOcclusionModule.GetOcclusionMode();
			// Sanity check that the module we selected or instantiated actually supports the desired occlusionMode
			if (newModuleOcclusionMode !== occlusionMode) {
				warn("CameraScript ActivateOcclusionModule mismatch: ", this.activeOcclusionModule.GetOcclusionMode(), "!==", occlusionMode);
			}

			// Deactivate current module if there is one
			if (prevOcclusionModule) {
				// Sanity check that current module is not being replaced by itself (that should have been handled above)
				if (prevOcclusionModule !== this.activeOcclusionModule) {
					prevOcclusionModule.Enable(false);
				} else {
					warn("CameraScript ActivateOcclusionModule failure to detect already running correct module");
				}
			}

			// Occlusion modules need to be initialized with information about characters and cameraSubject
			// Invisicam needs the LocalPlayer's character
			// Poppercam needs all player characters and the camera subject
			if (occlusionMode === Enum.DevCameraOcclusionMode.Invisicam) {
				// Optimization to only send Invisicam what we know it needs
				if (Players.LocalPlayer.Character) this.activeOcclusionModule.CharacterAdded(Players.LocalPlayer.Character, Players.LocalPlayer);
			} else {
				// When Poppercam is enabled, we send it all existing player characters for its raycast ignore list
				Players.GetPlayers().forEach(player => player.Character && this.activeOcclusionModule?.CharacterAdded(player.Character, player));

				this.activeOcclusionModule.OnCameraSubjectChanged((game.Workspace.CurrentCamera as Camera).CameraSubject);
			}
		}

		print(this.activeOcclusionModule);
		// Activate new choice
		this.activeOcclusionModule.Enable(true);
	}

	/**
	 * Note: Called whenever workspace.CurrentCamera changes, but also on initialization of this script
	 */
	OnCurrentCameraChanged() {
		const currentCamera = Workspace.CurrentCamera;

		if (!currentCamera) return;

		if (this.cameraSubjectChangedConn) {
			this.cameraSubjectChangedConn.Disconnect();
		}

		if (this.cameraTypeChangedConn) {
			this.cameraTypeChangedConn.Disconnect();
		}

		this.cameraSubjectChangedConn = currentCamera.GetPropertyChangedSignal("CameraSubject").Connect(() => this.OnCameraSubjectChanged(currentCamera.CameraSubject));

		this.cameraTypeChangedConn = currentCamera.GetPropertyChangedSignal("CameraType").Connect(() => this.OnCameraTypeChanged(currentCamera.CameraType));

		this.OnCameraSubjectChanged(currentCamera.CameraSubject);
		this.OnCameraTypeChanged(currentCamera.CameraType);
	}

	/**
	 * Note: The active transparency controller could be made to listen for this event itself.
	 */
	OnCameraSubjectChanged(CameraSubject: Humanoid | BasePart | undefined): void {
		const camera = Workspace.CurrentCamera;
		const cameraSubject = camera && camera.CameraSubject;

		if (this.activeTransparencyController) {
			this.activeTransparencyController.SetSubject(cameraSubject);
		}

		if (this.activeOcclusionModule) {
			this.activeOcclusionModule.OnCameraSubjectChanged(cameraSubject);
		}

		this.ActivateCameraController(undefined, camera && camera.CameraType);
	}

	OnCameraTypeChanged(newCameraType: Enum.CameraType): void {
		if (newCameraType === Enum.CameraType.Scriptable) {
			if (UserInputService.MouseBehavior === Enum.MouseBehavior.LockCenter) {
				CameraUtils.restoreMouseBehavior();
			}
		}

		//Forward the change to ActivateCameraController to handle
		this.ActivateCameraController(undefined, newCameraType);
	}

	Update(dt: number): void {
		if (this.activeCameraController) {
			this.activeCameraController.UpdateMouseBehavior();

			let [newCameraCFrame, newCameraFocus] = this.activeCameraController.Update(dt);

			if (this.activeOcclusionModule)
				[newCameraCFrame, newCameraFocus] = this.activeOcclusionModule.Update(dt, newCameraCFrame, newCameraFocus);

			// Here is where the new CFrame and Focus are set for this render frame
			const currentCamera = Workspace.CurrentCamera as Camera;

			currentCamera.CFrame = newCameraCFrame;
			currentCamera.Focus = newCameraFocus;

			// Update to character local transparency as needed based on camera-to-subject distance
			this.activeTransparencyController?.Update(dt);

			if (CameraInput.getInputEnabled()) CameraInput.resetInputForFrameEnd();
		}
	}

	OnLocalPlayerCameraPropertyChanged(propertyName: string): void {
		switch (propertyName) {
			case "CameraMode":
				// CameraMode is only used to turn on/off forcing the player into first person view. The
				// Note: The case "Classic" is used for all other views and does not correspond only to the ClassicCamera module
				if (Players.LocalPlayer.CameraMode === Enum.CameraMode.LockFirstPerson) {
					// Locked in first person, use ClassicCamera which supports this
					if (!this.activeCameraController || this.activeCameraController.GetModuleName() !== "ClassicCamera") {
						this.ActivateCameraController(CameraUtils.ConvertCameraModeEnumToStandard(Enum.DevComputerCameraMovementMode.Classic));
					}

					if (this.activeCameraController) {
						this.activeCameraController.UpdateForDistancePropertyChange();
					}
				} else if (Players.LocalPlayer.CameraMode === Enum.CameraMode.Classic) {
					// Not locked in first person view
					const cameraMovementMode = this.GetCameraMovementModeFromSettings();
					this.ActivateCameraController(CameraUtils.ConvertCameraModeEnumToStandard(cameraMovementMode));
				} else {
					warn("Unhandled value for property player.CameraMode: ", Players.LocalPlayer.CameraMode);
				}

				break;
			case "DevComputerCameraMode":
			case "DevTouchCameraMode":
				// eslint-disable-next-line no-case-declarations
				const cameraMovementMode = this.GetCameraMovementModeFromSettings();
				this.ActivateCameraController(CameraUtils.ConvertCameraModeEnumToStandard(cameraMovementMode));

				break;
			case "DevCameraOcclusionMode":
				this.ActivateOcclusionModule(Players.LocalPlayer.DevCameraOcclusionMode);

				break;
			case "DevTouchMovementMode":
				break;
			case "DevComputerMovementMode":
				break;
			case "DevEnableMouseLock":
			// This is the enabling/disabling of "Shift Lock" mode, not LockFirstPerson (which is a CameraMode)
			// Note: Enabling and disabling of MouseLock mode is normally only a publish-time choice made via
			// the corresponding EnableMouseLockOption checkbox of StarterPlayer, and this script does not have
			// support for changing the availability of MouseLock at runtime (this would require listening to
			// Player.DevEnableMouseLock changes)
		}
	}

	public OnUserGameSettingsPropertyChanged(propertyName: string) {
		if (propertyName === "ComputerCameraMovementMode") {
			this.ActivateCameraController(CameraUtils.ConvertCameraModeEnumToStandard(this.GetCameraMovementModeFromSettings()));
		}
	}

	GetCameraMovementModeFromSettings(): CameraUtils.StandardizedMovementModes {
		const cameraMode = Players.LocalPlayer.CameraMode;

		// Lock First Person trumps all other settings and forces ClassicCamera
		if (cameraMode === Enum.CameraMode.LockFirstPerson) {
			return CameraUtils.ConvertCameraModeEnumToStandard(Enum.ComputerCameraMovementMode.Classic);
		}

		let devMode, userMode;
		if (UserInputService.TouchEnabled) {
			devMode = CameraUtils.ConvertCameraModeEnumToStandard(Players.LocalPlayer.DevTouchCameraMode);
			userMode = CameraUtils.ConvertCameraModeEnumToStandard(UserGameSettings.TouchCameraMovementMode);
		} else {
			devMode = CameraUtils.ConvertCameraModeEnumToStandard(Players.LocalPlayer.DevComputerCameraMode);
			userMode = CameraUtils.ConvertCameraModeEnumToStandard(UserGameSettings.ComputerCameraMovementMode);
		}

		if (devMode === Enum.DevComputerCameraMovementMode.UserChoice) {
			// Developer is allowing user choice, so user setting is respected
			return userMode;
		}

		return devMode;
	}

	private static getInstantiatedCameraController<T extends BaseCamera>(clazz: Constructable<T>): T | undefined {
		return this.instantiatedCameraControllers.get(clazz) as T;
	}

	private static getInstantiatedOcclusionModule<T extends BaseOcclusion>(clazz: Constructable<T>): T | undefined {
		return this.instantiatedOcclusionModules.get(clazz) as T;
	}
}