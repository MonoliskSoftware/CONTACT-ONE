import { Players, UserInputService, VRService, Workspace } from "@rbxts/services";
import { Connection } from "CORP/shared/Libraries/Signal";
import { FlagUtil } from "../FlagUtil";
import { PlayerModule } from "../PlayerModule";
import { CameraInput } from "./CameraInput";
import { CameraToggleStateController } from "./CameraToggleStateController";
import { CameraUI } from "./CameraUI";
import { CameraUtils } from "./CameraUtils";
import { ZoomController } from "./ZoomController";

const FFlagUserFixGamepadMaxZoom = FlagUtil.getUserFlag("UserFixGamepadMaxZoom");
const FFlagUserFixCameraOffsetJitter = FlagUtil.getUserFlag("UserFixCameraOffsetJitter2");

const UserGameSettings = UserSettings().GetService("UserGameSettings");

const DEFAULT_DISTANCE = 12.5;	// Studs

const ZOOM_SENSITIVITY_CURVATURE = 0.5;
const FIRST_PERSON_DISTANCE_MIN = 0.5;
const FIRST_PERSON_DISTANCE_THRESHOLD = 1;

// Note: DotProduct check in CoordinateFrame::lookAt() prevents using values within about
// 8.11 degrees of the +/- Y axis, that's why these limits are currently 80 degrees
const MIN_Y = math.rad(-80);
const MAX_Y = math.rad(80);

const VR_ANGLE = math.rad(15);
const VR_LOW_INTENSITY_ROTATION = new Vector2(math.rad(15), 0);
const VR_HIGH_INTENSITY_ROTATION = new Vector2(math.rad(45), 0);
const VR_LOW_INTENSITY_REPEAT = 0.1;
const VR_HIGH_INTENSITY_REPEAT = 0.4;

const SEAT_OFFSET = new Vector3(0, 5, 0);
const VR_SEAT_OFFSET = new Vector3(0, 4, 0);
const HEAD_OFFSET = new Vector3(0, 1.5, 0);
const R15_HEAD_OFFSET = new Vector3(0, 1.5, 0);
const R15_HEAD_OFFSET_NO_SCALING = new Vector3(0, 2, 0);
const HUMANOID_ROOT_PART_SIZE = new Vector3(2, 2, 1);

const player = Players.LocalPlayer;

export abstract class BaseCamera {
	protected static readonly FIRST_PERSON_DISTANCE_THRESHOLD = FIRST_PERSON_DISTANCE_THRESHOLD;

	protected gamepadZoomLevels = [0, 10, 20]; // zoom levels that are cycled through on a gamepad R3 press

	cameraType: Enum.CameraType | undefined;
	cameraMovementMode: CameraUtils.StandardizedMovementModes | undefined;

	lastCameraTransform: CFrame | undefined;
	lastCameraFocus: CFrame | undefined;
	lastUserPanCamera = tick();

	humanoidRootPart: BasePart | undefined;
	humanoidCache = new Map<Player, Humanoid>();

	// Subject and position on last update call
	lastSubject: Instance | undefined;
	lastSubjectPosition = new Vector3(0, 5, 0);
	lastSubjectCFrame: CFrame | undefined = new CFrame(this.lastSubjectPosition);

	currentSubjectDistance = math.clamp(DEFAULT_DISTANCE, player.CameraMinZoomDistance, player.CameraMaxZoomDistance);

	inFirstPerson = false;
	inMouseLockedMode = false;
	portraitMode = false;
	isSmallTouchScreen = false;

	// Used by modules which want to reset the camera angle on respawn.
	resetCameraAngle = true;

	enabled = false;

	// Input Event Connections
	PlayerGui: PlayerGui | undefined;

	cameraChangedConn: RBXScriptConnection | undefined;
	viewportSizeChangedConn: RBXScriptConnection | undefined;

	// VR Support
	// shouldUseVRRotation = false; // Not used anywhere else in defs
	// VRRotationIntensityAvailable = false; // Not used anywhere else in defs
	// lastVRRotationIntensityCheckTime = 0; // Not used anywhere else in defs
	// lastVRRotationTime = 0; // Not used anywhere else in defs
	// vrRotateKeyCooldown; // Not used anywhere else in defs
	cameraTranslationConstraints = Vector3.one;
	// humanoidJumpOrigin = nil; // Not used anywhere else in defs
	// trackingHumanoid = nil; // Not used anywhere else in defs
	// cameraFrozen = false; // Not used anywhere else in defs
	subjectStateChangedConn: RBXScriptConnection | undefined;

	gamepadZoomPressConnection: Connection<[]> | undefined;

	// Mouse locked formerly known as shift lock mode
	mouseLockOffset = Vector3.zero;
	playerCameraModeChangeConn: RBXScriptConnection | undefined;
	minDistanceChangeConn: RBXScriptConnection | undefined;
	maxDistanceChangeConn: RBXScriptConnection | undefined;
	playerDevTouchMoveModeChangeConn: RBXScriptConnection | undefined;
	gameSettingsTouchMoveMoveChangeConn: RBXScriptConnection | undefined;
	hasGameLoaded: boolean;
	gameLoadedConn: RBXScriptConnection | undefined;
	isAToolEquipped: boolean = false;
	isDynamicThumbstickEnabled: boolean = false;
	isCameraToggle: boolean = false;
	cameraSubjectChangedConn: RBXScriptConnection | undefined;

	protected playerModule: PlayerModule;

	constructor(playerModule: PlayerModule) {
		this.playerModule = playerModule;
		
		// Initialization things used to always execute at game load time, but now these camera modules are instantiated
		// when needed, so the code here may run well after the start of the game
		if (player.Character) this.OnCharacterAdded(player.Character);

		player.CharacterAdded.Connect(char => this.OnCharacterAdded(char));

		if (this.playerCameraModeChangeConn) this.playerCameraModeChangeConn.Disconnect();

		this.playerCameraModeChangeConn = player.GetPropertyChangedSignal("CameraMode").Connect(() => {
			this.OnPlayerCameraPropertyChange();
		});

		if (this.minDistanceChangeConn) {
			this.minDistanceChangeConn.Disconnect();
			this.minDistanceChangeConn = player.GetPropertyChangedSignal("CameraMinZoomDistance").Connect(() => {
				this.OnPlayerCameraPropertyChange();
			});
		}

		if (this.maxDistanceChangeConn) this.maxDistanceChangeConn.Disconnect();
		this.maxDistanceChangeConn = player.GetPropertyChangedSignal("CameraMaxZoomDistance").Connect(() => {
			this.OnPlayerCameraPropertyChange();
		});

		if (this.playerDevTouchMoveModeChangeConn) this.playerDevTouchMoveModeChangeConn.Disconnect();
		this.playerDevTouchMoveModeChangeConn = player.GetPropertyChangedSignal("DevTouchMovementMode").Connect(() => {
			this.OnDevTouchMovementModeChanged();
		});
		this.OnDevTouchMovementModeChanged(); // Init

		if (this.gameSettingsTouchMoveMoveChangeConn) this.gameSettingsTouchMoveMoveChangeConn.Disconnect();
		this.gameSettingsTouchMoveMoveChangeConn = UserGameSettings.GetPropertyChangedSignal("TouchMovementMode").Connect(() => {
			this.OnGameSettingsTouchMovementModeChanged();
		});
		this.OnGameSettingsTouchMovementModeChanged(); // Init

		UserGameSettings.SetCameraYInvertVisible();
		UserGameSettings.SetGamepadCameraSensitivityVisible();

		this.hasGameLoaded = game.IsLoaded();
		if (!this.hasGameLoaded) {
			this.gameLoadedConn = game.Loaded.Connect(() => {
				this.hasGameLoaded = true;
				this.gameLoadedConn?.Disconnect();
				this.gameLoadedConn = undefined;
			});
		}

		// this.OnPlayerCameraPropertyChange();
	}

	OnCharacterAdded(char: Model) {
		this.resetCameraAngle = this.resetCameraAngle || this.GetEnabled();
		this.humanoidRootPart = undefined;

		if (UserInputService.TouchEnabled) {
			this.PlayerGui = player.WaitForChild("PlayerGui") as PlayerGui;

			if (char.GetChildren().some(child => child.IsA("Tool"))) this.isAToolEquipped = true;

			char.ChildAdded.Connect(child => {
				if (child.IsA("Tool")) this.isAToolEquipped = true;
			});

			char.ChildRemoved.Connect(child => {
				if (child.IsA("Tool")) this.isAToolEquipped = false;
			});
		}
	}

	GetEnabled(): boolean {
		return this.enabled;
	}

	OnPlayerCameraPropertyChange() {
		// This call forces re-evaluation of player.CameraMode and clamping to min/max distance which may have changed
		this.SetCameraToSubjectDistance(this.currentSubjectDistance);
	}

	SetCameraToSubjectDistance(desiredSubjectDistance: number) {
		const lastSubjectDistance = this.currentSubjectDistance;

		// By default, camera modules will respect LockFirstPerson and override the currentSubjectDistance with 0
		// regardless of what Player.CameraMinZoomDistance is set to, so that first person can be made
		// available by the developer without needing to allow players to mousewheel dolly into first person.
		// Some modules will override this function to remove or change first-person capability.
		if (player.CameraMode === Enum.CameraMode.LockFirstPerson) {
			this.currentSubjectDistance = 0.5;
			if (!this.inFirstPerson) {
				this.EnterFirstPerson();
			}
		} else {
			const newSubjectDistance = math.clamp(desiredSubjectDistance, player.CameraMinZoomDistance, player.CameraMaxZoomDistance);

			if (newSubjectDistance < FIRST_PERSON_DISTANCE_THRESHOLD) {
				this.currentSubjectDistance = 0.5;
				if (!this.inFirstPerson) {
					this.EnterFirstPerson();
				}
			} else {
				this.currentSubjectDistance = newSubjectDistance;
				if (this.inFirstPerson) {
					this.LeaveFirstPerson();
				}
			}
		}

		// Pass target distance and zoom direction to the zoom controller
		ZoomController.singleton.SetZoomParameters(this.currentSubjectDistance, math.sign(desiredSubjectDistance - lastSubjectDistance));

		// Returned only for convenience to the caller to know the outcome
		return this.currentSubjectDistance;
	}

	UpdateMouseBehavior() {
		const blockToggleDueToClickToMove = UserGameSettings.ComputerMovementMode === Enum.ComputerMovementMode.ClickToMove;

		if (this.isCameraToggle && blockToggleDueToClickToMove === false) {
			CameraUI.setCameraModeToastEnabled(true);
			CameraInput.enableCameraToggleInput();
			CameraToggleStateController(this.inFirstPerson);
		} else {
			CameraUI.setCameraModeToastEnabled(false);
			CameraInput.disableCameraToggleInput();

			//first time transition to first person mode or mouse - locked third person
			if (this.inFirstPerson || this.inMouseLockedMode) {
				CameraUtils.setRotationTypeOverride(Enum.RotationType.CameraRelative);
				CameraUtils.setMouseBehaviorOverride(Enum.MouseBehavior.LockCenter);
			} else {
				CameraUtils.restoreRotationType();

				const rotationActivated = CameraInput.getRotationActivated();
				if (rotationActivated) {
					CameraUtils.setMouseBehaviorOverride(Enum.MouseBehavior.LockCurrentPosition);
				} else {
					CameraUtils.restoreMouseBehavior();
				}
			}
		}
	}

	EnterFirstPerson() {
		this.inFirstPerson = true;
		this.UpdateMouseBehavior();
	}

	LeaveFirstPerson() {
		this.inFirstPerson = false;
		this.UpdateMouseBehavior();
	}

	OnDevTouchMovementModeChanged() {
		if (player.DevTouchMovementMode === Enum.DevTouchMovementMode.DynamicThumbstick) {
			this.OnDynamicThumbstickEnabled();
		} else {
			this.OnGameSettingsTouchMovementModeChanged();
		}
	}

	OnDynamicThumbstickEnabled() {
		if (UserInputService.TouchEnabled) {
			this.isDynamicThumbstickEnabled = true;
		}
	}

	OnGameSettingsTouchMovementModeChanged() {
		if (player.DevTouchMovementMode === Enum.DevTouchMovementMode.UserChoice) {
			if (UserGameSettings.TouchMovementMode === Enum.TouchMovementMode.DynamicThumbstick
				|| UserGameSettings.TouchMovementMode === Enum.TouchMovementMode.Default) {
				this.OnDynamicThumbstickEnabled();
			} else {
				this.OnDynamicThumbstickDisabled();
			}
		}
	}

	OnDynamicThumbstickDisabled() {
		this.isDynamicThumbstickEnabled = false;
	}

	Enable(enable: boolean) {
		if (this.enabled !== enable) {
			this.enabled = enable;

			this.OnEnabledChanged();
		}
	}

	// Movement mode standardized to Enum.ComputerCameraMovementMode values
	SetCameraMovementMode(cameraMovementMode: CameraUtils.StandardizedMovementModes) {
		this.cameraMovementMode = cameraMovementMode;
	}

	SetCameraType(cameraType: Enum.CameraType | undefined) {
		// Used by derived classes
		this.cameraType = cameraType;
	}

	OnEnabledChanged() {
		if (this.enabled) {
			CameraInput.setInputEnabled(true);

			this.gamepadZoomPressConnection = CameraInput.onGamepadZoomPress.Connect(() => this.GamepadZoomPress());

			if (player.CameraMode === Enum.CameraMode.LockFirstPerson) {
				this.currentSubjectDistance = 0.5;
				if (!this.inFirstPerson)
					this.EnterFirstPerson();
			}

			if (this.cameraChangedConn) {
				this.cameraChangedConn.Disconnect();
				this.cameraChangedConn = undefined;
			}
			this.cameraChangedConn = Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(() => this.OnCurrentCameraChanged());
			this.OnCurrentCameraChanged();
		} else {
			CameraInput.setInputEnabled(false);

			if (this.gamepadZoomPressConnection) {
				this.gamepadZoomPressConnection.Disconnect();
				this.gamepadZoomPressConnection = undefined;
			}
		}

		// Clean up additional event listeners and reset a bunch of properties
		this.Cleanup();
	}

	/**
	 * cycles between zoom levels in self.gamepadZoomLevels, setting CameraToSubjectDistance. gamepadZoomLevels may
	 * be out of range of Min/Max camera zoom
	 */
	GamepadZoomPress(): void {
		// this code relies on the fact that SetCameraToSubjectDistance will clamp the min and max
		const dist = this.GetCameraToSubjectDistance();

		let max = player.CameraMaxZoomDistance;

		// check from largest to smallest, set the first zoom level which is 
		// below the threshold
		for (let i = this.gamepadZoomLevels.size(); i >= 1; i--) {
			let zoom = this.gamepadZoomLevels[i];

			if (max < zoom) {
				continue;
			}

			if (zoom < player.CameraMinZoomDistance) {
				zoom = player.CameraMinZoomDistance;

				if (FFlagUserFixGamepadMaxZoom) {
					// no more zoom levels to check, all the remaining ones
					// are < min
					if (max === zoom) {
						break;
					}
				}
			}

			if (!FFlagUserFixGamepadMaxZoom) {
				if (max === zoom) {
					break;
				}
			}

			// theshold is set at halfway between zoom levels
			if (dist > zoom + (max - zoom) / 2) {
				this.SetCameraToSubjectDistance(zoom);
				return;
			}

			max = zoom;
		}

		// cycle back to the largest, relies on the fact that SetCameraToSubjectDistance will clamp max and min
		this.SetCameraToSubjectDistance(this.gamepadZoomLevels[this.gamepadZoomLevels.size()]);
	}

	GetCameraToSubjectDistance(): number {
		return this.currentSubjectDistance;
	}

	OnCurrentCameraChanged(): void {
		if (UserInputService.TouchEnabled) {
			if (this.viewportSizeChangedConn) {
				this.viewportSizeChangedConn.Disconnect();
				this.viewportSizeChangedConn = undefined;
			}

			const newCamera = game.Workspace.CurrentCamera;

			if (newCamera) {
				this.OnViewportSizeChanged();
				this.viewportSizeChangedConn = newCamera.GetPropertyChangedSignal("ViewportSize").Connect(() => this.OnViewportSizeChanged());
			}
		}

		//VR support additions
		if (this.cameraSubjectChangedConn) {
			this.cameraSubjectChangedConn.Disconnect();
			this.cameraSubjectChangedConn = undefined;
		}

		const camera = game.Workspace.CurrentCamera;
		if (camera) {
			this.cameraSubjectChangedConn = camera.GetPropertyChangedSignal("CameraSubject").Connect(() => this.OnNewCameraSubject());
			this.OnNewCameraSubject();
		}
	}

	OnViewportSizeChanged() {
		const camera = Workspace.CurrentCamera;

		assert(camera);

		const size = camera.ViewportSize;

		this.portraitMode = size.X < size.Y;
		this.isSmallTouchScreen = UserInputService.TouchEnabled && (size.Y < 500 || size.X < 700);
	}

	OnNewCameraSubject(): void {
		if (this.subjectStateChangedConn) {
			this.subjectStateChangedConn.Disconnect();
			this.subjectStateChangedConn = undefined;
		}
	}

	Cleanup() {
		if (this.subjectStateChangedConn) {
			this.subjectStateChangedConn.Disconnect();
			this.subjectStateChangedConn = undefined;
		}
		if (this.viewportSizeChangedConn) {
			this.viewportSizeChangedConn.Disconnect();
			this.viewportSizeChangedConn = undefined;
		}
		if (this.cameraChangedConn) {
			this.cameraChangedConn.Disconnect();
			this.cameraChangedConn = undefined;
		}

		this.lastCameraTransform = undefined;
		this.lastSubjectCFrame = undefined;

		// Unlock mouse for example if right mouse button was being held down
		CameraUtils.restoreMouseBehavior();
	}

	UpdateForDistancePropertyChange() {
		// Calling this setter with the current value will force checking that it is still
		// in range after a change to the min/max distance limits
		this.SetCameraToSubjectDistance(this.currentSubjectDistance);
	}

	SetMouseLockOffset(offsetVector: Vector3) {
		this.mouseLockOffset = offsetVector;
	}

	SetIsMouseLocked(mouseLocked: boolean) {
		this.inMouseLockedMode = mouseLocked;
	}

	IsInFirstPerson() {
		return this.inFirstPerson;
	}

	GetHumanoidRootPart(): BasePart {
		if (!this.humanoidRootPart && player.Character) {
			const humanoid = player.Character.FindFirstChildOfClass("Humanoid");

			if (humanoid) {
				this.humanoidRootPart = humanoid.RootPart;
			}
		}

		return this.humanoidRootPart as BasePart;
	}

	GetHumanoid(): Humanoid | undefined {
		const character = player?.Character;

		if (!character) return undefined;

		const resultHumanoid = this.humanoidCache.get(player);

		if (resultHumanoid && resultHumanoid.Parent === character) return resultHumanoid;

		this.humanoidCache.delete(player); // Bust Old Cache

		const humanoid = character.FindFirstAncestorOfClass("Humanoid");

		if (humanoid) this.humanoidCache.set(player, humanoid);

		return humanoid;
	}

	GetCameraHeight() {
		if (VRService.VREnabled && !this.inFirstPerson) return math.sin(VR_ANGLE) * this.currentSubjectDistance;

		return 0;
	}

	GetSubjectPosition(): Vector3 | undefined {
		let result = this.lastSubjectPosition;
		const camera = game.Workspace.CurrentCamera as Camera;
		const cameraSubject = camera && camera.CameraSubject as BasePart | VehicleSeat | Model | Humanoid | SkateboardPlatform | undefined;

		if (cameraSubject) {
			if (cameraSubject.IsA("Humanoid")) {
				const humanoid = cameraSubject;
				const humanoidIsDead = humanoid.GetState() === Enum.HumanoidStateType.Dead;

				let cameraOffset = humanoid.CameraOffset;
				// when in mouse lock mode, the character's rotation follows the camera instead of vice versa.
				// Allow the mouse lock calculation to be camera based instead of subject based to prevent jitter
				if (FFlagUserFixCameraOffsetJitter && this.GetIsMouseLocked()) {
					cameraOffset = new Vector3();
				}

				let bodyPartToFollow = humanoid.RootPart as Instance | undefined;

				// if the humanoid is dead, prefer their head part as a follow target, if it exists
				if (humanoidIsDead) {
					if (humanoid.Parent && humanoid.Parent.IsA("Model")) {
						bodyPartToFollow = humanoid.Parent.FindFirstChild("Head") ?? bodyPartToFollow;
					}
				}

				if (bodyPartToFollow && bodyPartToFollow.IsA("BasePart")) {
					let heightOffset;

					if (humanoid.RigType === Enum.HumanoidRigType.R15) {
						if (humanoid.AutomaticScalingEnabled) {
							heightOffset = R15_HEAD_OFFSET;
							if (bodyPartToFollow === humanoid.RootPart) {
								const rootPartSizeOffset = (humanoid.RootPart.Size.Y / 2) - (HUMANOID_ROOT_PART_SIZE.Y / 2);
								heightOffset = heightOffset.add(new Vector3(0, rootPartSizeOffset, 0));
							}
						} else {
							heightOffset = R15_HEAD_OFFSET_NO_SCALING;
						}
					} else {
						heightOffset = HEAD_OFFSET;
					}

					if (humanoidIsDead) {
						heightOffset = Vector3.zero;
					}

					result = bodyPartToFollow.CFrame.Position.add(bodyPartToFollow.CFrame.VectorToWorldSpace(heightOffset.add(cameraOffset)));
				}

			} else if (cameraSubject.IsA("VehicleSeat")) {
				const offset = SEAT_OFFSET;
				result = cameraSubject.CFrame.Position.add(cameraSubject.CFrame.VectorToWorldSpace(offset));
			} else if (cameraSubject.IsA("SkateboardPlatform")) {
				result = cameraSubject.CFrame.Position.add(SEAT_OFFSET);
			} else if (cameraSubject.IsA("BasePart")) {
				result = cameraSubject.CFrame.Position;
			} else if (cameraSubject.IsA("Model")) {
				result = cameraSubject.GetPivot().Position;
			}
		} else {
			// cameraSubject is nil
			// Note: Previous RootCamera did not have this }else{ case and let this.lastSubject and this.lastSubjectPosition
			// both get set to nil in the case of cameraSubject being nil. This function now exits here to preserve the
			// last set valid values for these, as nil values are not handled cases
			return undefined;
		}

		this.lastSubject = cameraSubject;
		this.lastSubjectPosition = result;

		return result;
	}

	GetSubjectCFrame(): CFrame {
		let result = this.lastSubjectCFrame;

		const camera = Workspace.CurrentCamera;
		const cameraSubject = camera ? camera.CameraSubject as BasePart | Model | Humanoid : undefined;
	
		if (!cameraSubject) return result as CFrame;
	
		if (cameraSubject.IsA("Humanoid")) {
			const humanoid = cameraSubject;
			const humanoidIsDead = humanoid.GetState() === Enum.HumanoidStateType.Dead;
	
			let cameraOffset = humanoid.CameraOffset;
			// When in mouse lock mode, the character's rotation follows the camera instead of vice versa.
			// Allow the mouse lock calculation to be camera-based instead of subject-based to prevent jitter.
			if (FFlagUserFixCameraOffsetJitter && this.GetIsMouseLocked()) {
				cameraOffset = new Vector3();
			}
	
			let bodyPartToFollow: BasePart | undefined = humanoid.RootPart;
	
			// If the humanoid is dead, prefer their head part as a follow target, if it exists.
			if (humanoidIsDead) {
				if (humanoid.Parent && humanoid.Parent.IsA("Model")) {
					bodyPartToFollow = humanoid.Parent.FindFirstChild("Head") as BasePart || bodyPartToFollow;
				}
			}
	
			if (bodyPartToFollow && bodyPartToFollow.IsA("BasePart")) {
				let heightOffset: Vector3;
	
				if (humanoid.RigType === Enum.HumanoidRigType.R15) {
					if (humanoid.AutomaticScalingEnabled) {
						heightOffset = R15_HEAD_OFFSET;
	
						const rootPart = humanoid.RootPart;
						if (bodyPartToFollow === rootPart) {
							const rootPartSizeOffset = (rootPart.Size.Y - HUMANOID_ROOT_PART_SIZE.Y) / 2;
							heightOffset = heightOffset.add(new Vector3(0, rootPartSizeOffset, 0));
						}
					} else {
						heightOffset = R15_HEAD_OFFSET_NO_SCALING;
					}
				} else {
					heightOffset = HEAD_OFFSET;
				}
	
				if (humanoidIsDead) {
					heightOffset = Vector3.zero;
				}
	
				result = bodyPartToFollow.CFrame.mul(new CFrame(heightOffset.add(cameraOffset)));
			}
	
		} else if (cameraSubject.IsA("BasePart")) {
			result = cameraSubject.CFrame;
	
		} else if (cameraSubject.IsA("Model")) {
			// Model subjects are expected to have a PrimaryPart to determine orientation.
			if (cameraSubject.PrimaryPart) {
				result = cameraSubject.GetPrimaryPartCFrame();
			} else {
				result = new CFrame();
			}
		}
	
		if (result) {
			this.lastSubjectCFrame = result;
		}
	
		return result as CFrame;
	}
	

	GetCameraLookVector(): Vector3 {
		return Workspace.CurrentCamera ? Workspace.CurrentCamera.CFrame.LookVector : new Vector3(0, 0, 1);
	}

	CalculateNewLookCFrameFromArg(suppliedLookVector: Vector3 | undefined, rotateInput: Vector2): CFrame {
		const currLookVector: Vector3 = suppliedLookVector || this.GetCameraLookVector();
		const currPitchAngle = math.asin(currLookVector.Y);
		const yTheta = math.clamp(rotateInput.Y, -MAX_Y + currPitchAngle, -MIN_Y + currPitchAngle);
		const constrainedRotateInput = new Vector2(rotateInput.X, yTheta);
		const startCFrame = new CFrame(Vector3.zero, currLookVector);
		const newLookCFrame = CFrame.Angles(0, -constrainedRotateInput.X, 0).mul(startCFrame).mul(CFrame.Angles(-constrainedRotateInput.Y, 0, 0));

		return newLookCFrame;
	}

	GetMouseLockOffset() {
		return this.mouseLockOffset;
	}

	GetIsMouseLocked(): boolean {
		return this.inMouseLockedMode;
	}

	CalculateNewLookVectorFromArg(suppliedLookVector: Vector3 | undefined, rotateInput: Vector2): Vector3 {
		const newLookCFrame = this.CalculateNewLookCFrameFromArg(suppliedLookVector, rotateInput);

		return newLookCFrame.LookVector;
	}
	
	StepZoom() {
		const zoom = this.currentSubjectDistance;
		const zoomDelta = CameraInput.getZoomDelta();

		if (math.abs(zoomDelta) > 0) {
			let newZoom;

			if (zoomDelta > 0) {
				newZoom = math.max(zoom + zoomDelta * (1 + zoom * ZOOM_SENSITIVITY_CURVATURE), BaseCamera.FIRST_PERSON_DISTANCE_THRESHOLD);
			} else {
				newZoom = math.max((zoom + zoomDelta) / (1 - zoomDelta * ZOOM_SENSITIVITY_CURVATURE), FIRST_PERSON_DISTANCE_MIN);
			}

			if (newZoom < BaseCamera.FIRST_PERSON_DISTANCE_THRESHOLD) newZoom = FIRST_PERSON_DISTANCE_MIN;

			this.SetCameraToSubjectDistance(newZoom);
		}

		return ZoomController.singleton.GetZoomRadius();
	}

	abstract Update(dt: number): LuaTuple<[CFrame, CFrame]>;
	abstract GetModuleName(): string;
}