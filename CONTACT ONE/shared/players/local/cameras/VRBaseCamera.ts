import { Lighting, Players, RunService, VRService, Workspace } from "@rbxts/services";
import { Connection } from "CORP/shared/Libraries/Signal";
import { FlagUtil } from "../FlagUtil";
import { PlayerModule } from "../PlayerModule";
import { BaseCamera } from "./BaseCamera";
import { CameraInput } from "./CameraInput";
import { ZoomController } from "./ZoomController";

// local constants
const VR_ANGLE = math.rad(15);
const VR_PANEL_SIZE = 512;
const VR_ZOOM = 7;
const VR_FADE_SPEED = 10; // 1/10 second
const VR_SCREEN_EGDE_BLEND_TIME = 0.14;
const VR_SEAT_OFFSET = new Vector3(0, 4, 0);

const UserGameSettings = UserSettings().GetService("UserGameSettings");

const FFlagUserCameraInputDt = FlagUtil.getUserFlag("UserCameraInputDt");
const FFlagUserVRVehicleCamera = FlagUtil.getUserFlag("UserVRVehicleCamera2");

/**
	VRBaseCamera - Base class for VR camera
	2021 Roblox VR
*/
export abstract class VRBaseCamera extends BaseCamera {
	/** zoom levels cycles when pressing R3 on a gamepad, not multiplied by headscale yet */
	gamepadZoomLevels = [0, VR_ZOOM];

	/** need to save headscale value to respond to changes */
	headScale = 1;

	/** VR screen effect */
	VRFadeResetTimer = 0;
	VREdgeBlurTimer = 0;

	/** initialize vr specific variables */
	needsReset = true;
	recentered = false;

	stepRotateTimeout = 0;

	thirdPersonOptionChanged: RBXScriptConnection | undefined;
	vrRecentered: RBXScriptConnection | undefined;
	cameraHeadScaleChangedConn: RBXScriptConnection | undefined;
	gamepadResetConnection: Connection | undefined;

	constructor(playerModule: PlayerModule) {
		super(playerModule);

		this.SetCameraToSubjectDistance(VR_ZOOM);

		// timer for step rotation
		this.Reset();

		return this;
	}

	Reset() {
		this.stepRotateTimeout = 0;
	}

	GetModuleName() {
		return "VRBaseCamera";
	}

	GamepadZoomPress() {
		super.GamepadZoomPress();

		// don't want the spring animation in VR, may cause motion sickness
		this.GamepadReset();
		this.ResetZoom();
	}

	GamepadReset() {
		this.stepRotateTimeout = 0;
		this.needsReset = true;
	}

	ResetZoom() {
		ZoomController.singleton.SetZoomParameters(this.currentSubjectDistance, 0);
		ZoomController.singleton.ReleaseSpring();
	}

	OnEnabledChanged() {
		super.OnEnabledChanged();

		if (this.enabled) {
			this.gamepadResetConnection = CameraInput.onGamepadReset?.Connect(() => {
				this.GamepadReset();
			});

			// reset on options change
			this.thirdPersonOptionChanged = VRService.GetPropertyChangedSignal("ThirdPersonFollowCamEnabled").Connect(() => {
				if (FFlagUserVRVehicleCamera) {
					this.Reset();
				} else {
					// only need to reset third person options if( in third person
					if (!this.IsInFirstPerson()) {
						this.Reset();
					}
				}
			});

			this.vrRecentered = VRService.UserCFrameChanged.Connect((userCFrame, _) => {
				if (userCFrame === Enum.UserCFrame.Floor) this.recentered = true;
			});
		} else {
			// make sure zoom is reset when switching to another camera
			if (this.inFirstPerson) {
				this.GamepadZoomPress();
			}

			// disconnect connections
			if (this.thirdPersonOptionChanged) {
				this.thirdPersonOptionChanged.Disconnect();
				this.thirdPersonOptionChanged = undefined;
			}

			if (this.vrRecentered) {
				this.vrRecentered.Disconnect();
				this.vrRecentered = undefined;
			}

			if (this.cameraHeadScaleChangedConn) {
				this.cameraHeadScaleChangedConn.Disconnect();
				this.cameraHeadScaleChangedConn = undefined;
			}

			if (this.gamepadResetConnection) {
				this.gamepadResetConnection.Disconnect();
				this.gamepadResetConnection = undefined;
			}

			// reset VR effects
			this.VREdgeBlurTimer = 0;
			this.UpdateEdgeBlur(Players.LocalPlayer, 1);

			const VRFade = Lighting.FindFirstChild("VRFade") as ColorCorrectionEffect | undefined;

			if (VRFade) VRFade.Brightness = 0;
		}
	}

	OnCurrentCameraChanged() {
		super.OnCurrentCameraChanged();

		// disconnect connections to reestablish on new camera
		if (this.cameraHeadScaleChangedConn) {
			this.cameraHeadScaleChangedConn.Disconnect();
			this.cameraHeadScaleChangedConn = undefined;
		}

		// add new connections if( camera is valid
		const camera = Workspace.CurrentCamera as Camera;

		if (camera) {
			this.cameraHeadScaleChangedConn = camera.GetPropertyChangedSignal("HeadScale").Connect(() => { this.OnHeadScaleChanged(); });
			this.OnHeadScaleChanged();
		}
	}

	OnHeadScaleChanged() {
		const camera = Workspace.CurrentCamera as Camera;
		const newHeadScale = camera.HeadScale;

		// scale zoom levels by headscale
		this.gamepadZoomLevels = this.gamepadZoomLevels.map(zoom => zoom * newHeadScale / this.headScale);

		// rescale current distance
		this.SetCameraToSubjectDistance(this.GetCameraToSubjectDistance() * newHeadScale / this.headScale);
		this.headScale = newHeadScale;
	}

	// defines subject && height of VR camera
	GetVRFocus(subjectPosition: Vector3, timeDelta: number) {
		const lastFocus = this.lastCameraFocus || subjectPosition;

		this.cameraTranslationConstraints = new Vector3(
			this.cameraTranslationConstraints.X,
			math.min(1, this.cameraTranslationConstraints.Y + timeDelta),
			this.cameraTranslationConstraints.Z);

		const cameraHeightDelta = new Vector3(0, this.GetCameraHeight(), 0);
		const newFocus = new CFrame(new Vector3(subjectPosition.X, lastFocus.Y, subjectPosition.Z).
			Lerp(subjectPosition.add(cameraHeightDelta), this.cameraTranslationConstraints.Y));

		return newFocus;
	}

	// (VR) Screen effects //////////////
	StartFadeFromBlack() {
		if (UserGameSettings.VignetteEnabled === false) return;

		let VRFade = Lighting.FindFirstChild("VRFade") as ColorCorrectionEffect;

		if (!VRFade) {
			VRFade = new Instance("ColorCorrectionEffect");
			VRFade.Name = "VRFade";
			VRFade.Parent = Lighting;
		}

		VRFade.Brightness = -1;

		this.VRFadeResetTimer = 0.1;
	}

	UpdateFadeFromBlack(timeDelta: number) {
		const VRFade = Lighting.FindFirstChild("VRFade") as ColorCorrectionEffect | undefined;

		if (this.VRFadeResetTimer > 0) {
			this.VRFadeResetTimer = math.max(this.VRFadeResetTimer - timeDelta, 0);

			const VRFade = Lighting.FindFirstChild("VRFade") as ColorCorrectionEffect | undefined;

			if (VRFade && VRFade.Brightness < 0) VRFade.Brightness = math.min(VRFade.Brightness + timeDelta * VR_FADE_SPEED, 0);
		} else {
			// sanity check, VRFade off
			if (VRFade) VRFade.Brightness = 0;
		}
	}

	StartVREdgeBlur(player: Player) {
		const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;

		if (UserGameSettings.VignetteEnabled === false) return;

		let blurPart = (Workspace.CurrentCamera as Camera).FindFirstChild("VRBlurPart") as Part | undefined;

		if (!blurPart) {
			const basePartSize = new Vector3(0.44, 0.47, 1);

			blurPart = new Instance("Part");
			blurPart.Name = "VRBlurPart";
			blurPart.Parent = Workspace.CurrentCamera;
			blurPart.CanTouch = false;
			blurPart.CanCollide = false;
			blurPart.CanQuery = false;
			blurPart.Anchored = true;
			blurPart.Size = basePartSize;
			blurPart.Transparency = 1;
			blurPart.CastShadow = false;

			RunService.RenderStepped.Connect((step) => {
				const userHeadCF = VRService.GetUserCFrame(Enum.UserCFrame.Head);
				const camera = Workspace.CurrentCamera as Camera;

				assert(blurPart);

				const vrCF = camera.CFrame.mul(new CFrame(userHeadCF.Position.mul(camera.HeadScale)).mul(userHeadCF.sub(userHeadCF.Position)));

				blurPart.CFrame = (vrCF.mul(CFrame.Angles(0, math.rad(180), 0))).add(vrCF.LookVector.mul(1.05 * camera.HeadScale));
				blurPart.Size = basePartSize.mul(camera.HeadScale);
			});
		}

		let VRScreen = playerGui.FindFirstChild("VRBlurScreen") as SurfaceGui | undefined;
		let VRBlur = VRScreen?.FindFirstChild("VRBlur") as ImageLabel | undefined;

		if (!VRBlur) {
			if (!VRScreen) VRScreen = new Instance("SurfaceGui") ?? new Instance("ScreenGui");

			VRScreen.Name = "VRBlurScreen";
			VRScreen.Parent = playerGui;

			VRScreen.Adornee = blurPart;

			VRBlur = new Instance("ImageLabel");
			VRBlur.Name = "VRBlur";
			VRBlur.Parent = VRScreen;

			VRBlur.Image = "rbxasset://textures/ui/VR/edgeBlur.png";
			VRBlur.AnchorPoint = new Vector2(0.5, 0.5);
			VRBlur.Position = new UDim2(0.5, 0, 0.5, 0);

			// this computes the ratio between the GUI 3D panel && the VR viewport
			// adding 15% overshoot for edges on 2 screen headsets
			const ratioX = (Workspace.CurrentCamera as Camera).ViewportSize.X * 2.3 / VR_PANEL_SIZE;
			const ratioY = (Workspace.CurrentCamera as Camera).ViewportSize.Y * 2.3 / VR_PANEL_SIZE;

			VRBlur.Size = UDim2.fromScale(ratioX, ratioY);
			VRBlur.BackgroundTransparency = 1;
			VRBlur.Active = true;
			VRBlur.ScaleType = Enum.ScaleType.Stretch;
		}

		VRBlur.Visible = true;
		VRBlur.ImageTransparency = 0;

		this.VREdgeBlurTimer = VR_SCREEN_EGDE_BLEND_TIME;
	}

	UpdateEdgeBlur(player: Player, timeDelta: number) {
		const playerGui = player.WaitForChild("PlayerGui") as PlayerGui;
		const VRScreen = playerGui.FindFirstChild("VRBlurScreen");
		const VRBlur = VRScreen?.FindFirstChild("VRBlur") as ImageLabel | undefined;

		if (VRBlur) {
			if (this.VREdgeBlurTimer > 0) {
				this.VREdgeBlurTimer = this.VREdgeBlurTimer - timeDelta;

				const VRScreen = playerGui.FindFirstChild("VRBlurScreen");

				if (VRScreen) {
					const VRBlur = VRScreen.FindFirstChild("VRBlur") as ImageLabel | undefined;

					if (VRBlur) VRBlur.ImageTransparency = 1.0 - math.clamp(this.VREdgeBlurTimer, 0.01,
						VR_SCREEN_EGDE_BLEND_TIME) * (1 / VR_SCREEN_EGDE_BLEND_TIME);
				}
			} else {
				VRBlur.Visible = false;
			}
		}
	}

	GetCameraHeight() {
		if (!this.inFirstPerson) return math.sin(VR_ANGLE) * this.currentSubjectDistance;

		return 0;
	}

	GetSubjectCFrame(): CFrame {
		let result = super.GetSubjectCFrame();

		const camera = Workspace.CurrentCamera;
		const cameraSubject = camera && camera.CameraSubject;

		if (!cameraSubject) {
			return result;
		}

		// new VR system overrides
		if (cameraSubject.IsA("Humanoid")) {
			const humanoid = cameraSubject;
			const humanoidIsDead = humanoid.GetState() === Enum.HumanoidStateType.Dead;

			if (humanoidIsDead && humanoid === this.lastSubject) {
				result = this.lastSubjectCFrame as CFrame;
			}
		}

		if (result) {
			this.lastSubjectCFrame = result;
		}

		return result;
	}

	GetSubjectPosition(): Vector3 {
		let result = super.GetSubjectPosition();

		// new VR system overrides
		const camera = game.Workspace.CurrentCamera;
		const cameraSubject = camera && camera.CameraSubject;

		if (cameraSubject) {
			if (cameraSubject.IsA("Humanoid")) {
				const humanoid = cameraSubject;
				const humanoidIsDead = humanoid.GetState() === Enum.HumanoidStateType.Dead;

				if (humanoidIsDead && humanoid === this.lastSubject) result = this.lastSubjectPosition;
			} else if (cameraSubject.IsA("VehicleSeat")) {
				const offset = VR_SEAT_OFFSET;

				result = cameraSubject.CFrame.Position.add(cameraSubject.CFrame.VectorToWorldSpace(offset));
			}
		} else {
			return Vector3.zero;
		}

		this.lastSubjectPosition = result as Vector3;

		return result as Vector3;
	}

	// gets the desired rotation accounting for smooth rotation. Manages fades && resets resulting 
	// from rotation
	getRotation(dt: number) {
		const rotateInput = CameraInput.getRotation(dt);
		let yawDelta = 0;

		if (UserGameSettings.VRSmoothRotationEnabled) {
			if (FFlagUserCameraInputDt) {
				yawDelta = rotateInput.X;
			} else {
				yawDelta = rotateInput.X * 40 * dt;
			}
		} else {
			// ignore the magnitude of the input, use just the direction &&
			// a timer to rotate 30 degrees each step
			if (math.abs(rotateInput.X) > 0.03) {
				if (this.stepRotateTimeout > 0) {
					this.stepRotateTimeout -= dt;
				}

				if (this.stepRotateTimeout <= 0) {
					yawDelta = 1;
					if (rotateInput.X < 0) {
						yawDelta = -1;
					}

					yawDelta *= math.rad(30);
					this.StartFadeFromBlack();
					this.stepRotateTimeout = 0.25;
				}
			} else if (math.abs(rotateInput.X) < 0.02) {
				this.stepRotateTimeout = 0; // allow fast rotation when spamming input
			}
		}

		return yawDelta;

	}
}
////////////////////////////-

