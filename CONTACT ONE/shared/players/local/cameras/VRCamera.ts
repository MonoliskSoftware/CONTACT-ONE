import { Workspace } from "@rbxts/services";
import { PlayerModule } from "../PlayerModule";
import { VRBaseCamera } from "./VRBaseCamera";

const PlayersService = game.GetService("Players");
const VRService = game.GetService("VRService");
const UserGameSettings = UserSettings().GetService("UserGameSettings");

// const private variables && constants
const CAMERA_BLACKOUT_TIME = 0.1;
const FP_ZOOM = 0.5;
const TORSO_FORWARD_OFFSET_RATIO = 1 / 8;
const NECK_OFFSET = -0.7;

/**
	VRCamera - Roblox VR camera control module
	2021 Roblox VR
*/
export class VRCamera extends VRBaseCamera {
	lastUpdate = tick();
	focusOffset = new CFrame();
	controlModule = this.playerModule.controls;
	savedAutoRotate = true;

	motionDetTime = 0;
	needsBlackout = true;
	blackOutTimer = 0;
	lastCameraResetPosition: Vector3 | undefined;

	characterOrientation: AlignOrientation | undefined;

	NoRecenter = false;

	VRCameraFocusFrozen = false;

	constructor(playerModule: PlayerModule) {
		super(playerModule);

		this.Reset();
	}

	Reset() {
		this.needsReset = true;
		this.needsBlackout = true;
		this.motionDetTime = 0.0;
		this.blackOutTimer = 0;
		this.lastCameraResetPosition = undefined;

		super.Reset();
	}

	Update(timeDelta: number) {
		const camera = Workspace.CurrentCamera as Camera;
		let newCameraCFrame = camera.CFrame;
		let newCameraFocus = camera.Focus;

		const player = PlayersService.LocalPlayer;
		const humanoid = this.GetHumanoid();
		const cameraSubject = camera.CameraSubject;

		if (this.lastUpdate === undefined || timeDelta > 1) {
			this.lastCameraTransform = undefined;
		}

		// update fullscreen effects
		this.UpdateFadeFromBlack(timeDelta);
		this.UpdateEdgeBlur(player, timeDelta);

		const lastSubjPos = this.lastSubjectPosition;
		const subjectPosition: Vector3 = this.GetSubjectPosition();
		// transition from another camera || from spawn
		if (this.needsBlackout) {
			this.StartFadeFromBlack();

			const dt = math.clamp(timeDelta, 0.0001, 0.1);
			this.blackOutTimer += dt;

			if (this.blackOutTimer > CAMERA_BLACKOUT_TIME && game.IsLoaded()) {
				this.needsBlackout = false;
				this.needsReset = true;
			}
		}

		if (subjectPosition && player && camera) {
			newCameraFocus = this.GetVRFocus(subjectPosition, timeDelta);
			// update camera cframe based on first/third person
			if (this.IsInFirstPerson()) {
				if (VRService.AvatarGestures) {
					// the immersion camera better aligns the player with the avatar
					[newCameraCFrame, newCameraFocus] = this.UpdateImmersionCamera(
						timeDelta, newCameraCFrame, newCameraFocus, lastSubjPos, subjectPosition);
				} else {
					[newCameraCFrame, newCameraFocus] = this.UpdateFirstPersonTransform(
						timeDelta, newCameraCFrame, newCameraFocus, lastSubjPos, subjectPosition);
				}
			} else { // 3rd person
				if (VRService.ThirdPersonFollowCamEnabled) {
					[newCameraCFrame, newCameraFocus] = this.UpdateThirdPersonFollowTransform(
						timeDelta, newCameraCFrame, newCameraFocus, lastSubjPos, subjectPosition);
				} else {
					[newCameraCFrame, newCameraFocus] = this.UpdateThirdPersonComfortTransform(
						timeDelta, newCameraCFrame, newCameraFocus, lastSubjPos, subjectPosition);
				}
			}

			this.lastCameraTransform = newCameraCFrame;
			this.lastCameraFocus = newCameraFocus;
		}

		this.lastUpdate = tick();

		return $tuple(newCameraCFrame, newCameraFocus);
	}

	// returns where the floor should be placed given the camera subject, undefined if( anything is invalid
	GetAvatarFeetWorldYValue(): number | undefined {
		const camera = Workspace.CurrentCamera as Camera;
		const cameraSubject = camera.CameraSubject;
		if (!cameraSubject) return undefined;

		if (cameraSubject.IsA("Humanoid") && cameraSubject.RootPart) {
			const rootPart = cameraSubject.RootPart;
			return rootPart.Position.Y - rootPart.Size.Y / 2 - cameraSubject.HipHeight;
		}

		return undefined;
	}

	UpdateFirstPersonTransform(timeDelta: number, newCameraCFrame: CFrame, newCameraFocus: CFrame, lastSubjPos: Vector3, subjectPosition: Vector3) {
		// transition from TP to FP
		if (this.needsReset) {
			this.StartFadeFromBlack();
			this.needsReset = false;
		}

		// blur screen edge during movement
		const player = PlayersService.LocalPlayer;
		const subjectDelta = lastSubjPos.sub(subjectPosition);

		if (subjectDelta.Magnitude > 0.01) this.StartVREdgeBlur(player);
		// straight view, ! angled down
		const cameraFocusP = newCameraFocus.Position;
		let cameraLookVector = this.GetCameraLookVector();

		cameraLookVector = new Vector3(cameraLookVector.X, 0, cameraLookVector.Z).Unit;

		const yawDelta = this.getRotation(timeDelta);

		const newLookVector = this.CalculateNewLookVectorFromArg(cameraLookVector, new Vector2(yawDelta, 0));
		newCameraCFrame = new CFrame(cameraFocusP.sub(newLookVector.mul(FP_ZOOM)), cameraFocusP);

		return [newCameraCFrame, newCameraFocus];
	}

	UpdateImmersionCamera(timeDelta: number, newCameraCFrame: CFrame, newCameraFocus: CFrame, lastSubjPos: Vector3, subjectPosition: Vector3): [CFrame, CFrame] {
		const subjectCFrame = this.GetSubjectCFrame();
		const curCamera = Workspace.CurrentCamera as Camera;

		// character rotation details
		const character = PlayersService.LocalPlayer.Character as Model;
		const humanoid = this.GetHumanoid();

		if (!humanoid) return [curCamera.CFrame, curCamera.Focus];

		const humanoidRootPart = character.FindFirstChild("HumanoidRootPart");

		if (!humanoidRootPart) return [curCamera.CFrame, curCamera.Focus];

		this.characterOrientation = humanoidRootPart.FindFirstChild("CharacterAlignOrientation") as AlignOrientation | undefined;

		if (!this.characterOrientation) {
			const rootAttachment = humanoidRootPart.FindFirstChild("RootAttachment") as Attachment | undefined;

			if (!rootAttachment) return [CFrame.identity, CFrame.identity];

			this.characterOrientation = new Instance("AlignOrientation");
			this.characterOrientation.Name = "CharacterAlignOrientation";
			this.characterOrientation.Mode = Enum.OrientationAlignmentMode.OneAttachment;
			this.characterOrientation.Attachment0 = rootAttachment;
			this.characterOrientation.RigidityEnabled = true;
			this.characterOrientation.Parent = humanoidRootPart;
		}

		if (this.characterOrientation.Enabled === false) this.characterOrientation.Enabled = true;

		// just entered first person, || need to reset camera
		if (this.needsReset) {
			this.needsReset = false;

			this.savedAutoRotate = humanoid.AutoRotate;
			humanoid.AutoRotate = false;

			if (this.NoRecenter) {
				this.NoRecenter = false;
				VRService.RecenterUserHeadCFrame();
			}

			this.StartFadeFromBlack();

			// place the VR head at the subject's CFrame
			newCameraCFrame = subjectCFrame;
		} else {
			// if( seated, just keep aligned with the seat itself
			if (humanoid.Sit) {
				newCameraCFrame = subjectCFrame;
				if ((newCameraCFrame.Position.sub(curCamera.CFrame.Position)).Magnitude > 0.01) this.StartVREdgeBlur(PlayersService.LocalPlayer);
			} else {
				// keep character rotation with torso
				const torsoRotation = this.controlModule.GetEstimatedVRTorsoFrame();
				this.characterOrientation.CFrame = curCamera.CFrame.mul(torsoRotation);

				// The character continues moving for a brief moment after the moveVector stops. Continue updating the camera.
				if (this.controlModule.inputMoveVector.Magnitude > 0) {
					this.motionDetTime = 0.1;
				}

				if (this.controlModule.inputMoveVector.Magnitude > 0 || this.motionDetTime > 0) {
					this.motionDetTime -= timeDelta;

					// Add an edge blur if( the subject moved
					this.StartVREdgeBlur(PlayersService.LocalPlayer);

					// moving by input, so we should align the vrHead with the character
					let vrHeadOffset = VRService.GetUserCFrame(Enum.UserCFrame.Head);

					vrHeadOffset = vrHeadOffset.Rotation.add(vrHeadOffset.Position.mul(curCamera.HeadScale));

					// the location of the character's body should be "below" the head. Directly below if( the player is looking
					// forward, but further back if( they are looking down
					const hrp = character.WaitForChild("HumanoidRootPart") as Part;
					const neck_offset = NECK_OFFSET * hrp.Size.Y / 2;
					const hrpLook = hrp.CFrame.LookVector;
					let neckWorld = curCamera.CFrame.mul(vrHeadOffset).mul(new CFrame(0, neck_offset, 0));

					neckWorld = neckWorld.sub(new Vector3(hrpLook.X, 0, hrpLook.Z).Unit.mul(hrp.Size.Y).mul(TORSO_FORWARD_OFFSET_RATIO));

					// the camera must remain stable relative to the humanoid root part || the IK calculations will look jittery
					let goalCameraPosition = subjectPosition.sub(neckWorld.Position).add(curCamera.CFrame.Position);

					// maintain the Y value
					goalCameraPosition = new Vector3(goalCameraPosition.X, subjectPosition.Y, goalCameraPosition.Z);

					newCameraCFrame = curCamera.CFrame.Rotation.add(goalCameraPosition);
				} else {
					// don't change x, z position, follow the y value
					newCameraCFrame = curCamera.CFrame.Rotation.add(new Vector3(curCamera.CFrame.Position.X, subjectPosition.Y, curCamera.CFrame.Position.Z));
				}

				const yawDelta = this.getRotation(timeDelta);
				if (math.abs(yawDelta) > 0) {
					// The head location in world space
					let vrHeadOffset = VRService.GetUserCFrame(Enum.UserCFrame.Head);

					vrHeadOffset = vrHeadOffset.Rotation.add(vrHeadOffset.Position.mul(curCamera.HeadScale));

					const VRheadWorld = newCameraCFrame.mul(vrHeadOffset);

					const desiredVRHeadCFrame = new CFrame(VRheadWorld.Position).mul(CFrame.Angles(0, -math.rad(yawDelta * 90), 0)).mul(VRheadWorld.Rotation);

					// set the camera to place the VR head at the correct location
					newCameraCFrame = desiredVRHeadCFrame.mul(vrHeadOffset.Inverse());
				}
			}
		}

		return [newCameraCFrame, newCameraCFrame.mul(new CFrame(0, 0, -FP_ZOOM))];
	}

	UpdateThirdPersonComfortTransform(timeDelta: number, newCameraCFrame: CFrame, newCameraFocus: CFrame, lastSubjPos: Vector3, subjectPosition: Vector3) {
		const zoom = math.max(0.5, this.GetCameraToSubjectDistance());

		if (lastSubjPos !== undefined && this.lastCameraFocus !== undefined) {
			// compute delta of subject since last update
			const player = PlayersService.LocalPlayer;
			const subjectDelta = lastSubjPos.sub(subjectPosition);
			const moveVector = this.controlModule.GetMoveVector();

			// is the subject still moving?
			let isMoving = subjectDelta.Magnitude > 0.01 || moveVector.Magnitude > 0.01;

			if (isMoving) this.motionDetTime = 0.1;

			this.motionDetTime = this.motionDetTime - timeDelta;

			if (this.motionDetTime > 0) isMoving = true;

			if (isMoving && !this.needsReset) {
				// if( subject moves keep old camera focus
				newCameraFocus = this.lastCameraFocus;

				// if( the focus subject stopped, time to reset the camera
				this.VRCameraFocusFrozen = true;
			} else {
				const subjectMoved = this.lastCameraResetPosition === undefined || (subjectPosition.sub(this.lastCameraResetPosition)).Magnitude > 1;

				// compute offset for 3rd person camera rotation
				const yawDelta = this.getRotation(timeDelta);
				if (math.abs(yawDelta) > 0) {
					const cameraOffset = newCameraFocus.ToObjectSpace(newCameraCFrame);

					newCameraCFrame = newCameraFocus.mul(CFrame.Angles(0, -yawDelta, 0)).mul(cameraOffset);
				}

				// recenter the camera on teleport
				if ((this.VRCameraFocusFrozen && subjectMoved) || this.needsReset) {
					VRService.RecenterUserHeadCFrame();

					this.VRCameraFocusFrozen = false;
					this.needsReset = false;
					this.lastCameraResetPosition = subjectPosition;

					this.ResetZoom();
					this.StartFadeFromBlack();

					// get player facing direction
					const humanoid = this.GetHumanoid() as Humanoid;
					const forwardVector = humanoid.Torso ? humanoid.Torso.CFrame.LookVector : new Vector3(1, 0, 0);
					// adjust camera height
					const vecToCameraAtHeight = new Vector3(forwardVector.X, 0, forwardVector.Z);
					const newCameraPos = newCameraFocus.Position.sub(vecToCameraAtHeight.mul(zoom));
					// compute new cframe at height level to subject
					const lookAtPos = new Vector3(newCameraFocus.Position.X, newCameraPos.Y, newCameraFocus.Position.Z);

					newCameraCFrame = new CFrame(newCameraPos, lookAtPos);
				}
			}
		}

		return [newCameraCFrame, newCameraFocus];
	}

	UpdateThirdPersonFollowTransform(timeDelta: number, newCameraCFrame: CFrame, newCameraFocus: CFrame, lastSubjPos: Vector3, subjectPosition: Vector3): [CFrame, CFrame] {
		const camera = Workspace.CurrentCamera as Camera;
		const zoom = this.GetCameraToSubjectDistance();
		const vrFocus = this.GetVRFocus(subjectPosition, timeDelta);

		if (this.needsReset) {

			this.needsReset = false;

			VRService.RecenterUserHeadCFrame();
			this.ResetZoom();
			this.StartFadeFromBlack();
		}

		if (this.recentered) {
			const subjectCFrame = this.GetSubjectCFrame();

			// can't perform a reset until the subject is valid
			if (!subjectCFrame) return [camera.CFrame, camera.Focus];

			// set the camera && focus to zoom distance behind the subject
			newCameraCFrame = vrFocus.mul(subjectCFrame.Rotation).mul(new CFrame(0, 0, zoom));

			this.focusOffset = vrFocus.ToObjectSpace(newCameraCFrame); // GetVRFocus returns a CFrame with ! rotation

			this.recentered = false;

			return [newCameraCFrame, vrFocus];
		}

		const trackCameraCFrame = vrFocus.ToWorldSpace(this.focusOffset);

		// figure out if( the player is moving
		const player = PlayersService.LocalPlayer;
		const subjectDelta = lastSubjPos.sub(subjectPosition);
		const controlModule = this.controlModule;
		const moveVector = controlModule.GetMoveVector();

		// while moving, slowly adjust camera so the avatar is in front of your head
		if (subjectDelta.Magnitude > 0.01 || moveVector.Magnitude > 0) { // is the subject moving?
			let headOffset = controlModule.GetEstimatedVRTorsoFrame();

			// account for headscale
			headOffset = headOffset.Rotation.add(headOffset.Position.mul(camera.HeadScale));

			const headCframe = camera.CFrame.mul(headOffset);
			const headLook = headCframe.LookVector;

			const headVectorDirection = new Vector3(headLook.X, 0, headLook.Z).Unit.mul(zoom);
			const goalHeadPosition = vrFocus.Position.sub(headVectorDirection);

			// place the camera at currentposition + difference between goalHead && currentHead 
			const moveGoalCameraCFrame = new CFrame(camera.CFrame.Position.add(goalHeadPosition).sub(headCframe.Position)).mul(trackCameraCFrame.Rotation);

			newCameraCFrame = trackCameraCFrame.Lerp(moveGoalCameraCFrame, 0.01);
		} else {
			newCameraCFrame = trackCameraCFrame;
		}

		// compute offset for 3rd person camera rotation
		const yawDelta = this.getRotation(timeDelta);
		if (math.abs(yawDelta) > 0) {
			const cameraOffset = vrFocus.ToObjectSpace(newCameraCFrame);
			newCameraCFrame = vrFocus.mul(CFrame.Angles(0, -yawDelta, 0)).mul(cameraOffset);
		}

		this.focusOffset = vrFocus.ToObjectSpace(newCameraCFrame); // GetVRFocus returns a CFrame with ! rotation

		// focus is always in front of the camera
		newCameraFocus = newCameraCFrame.mul(new CFrame(0, 0, -zoom));

		// vignette
		if (newCameraFocus.Position.sub(camera.Focus.Position).Magnitude > 0.01) {
			this.StartVREdgeBlur(PlayersService.LocalPlayer);
		}

		return [newCameraCFrame, newCameraFocus];
	}

	LeaveFirstPerson() {
		super.LeaveFirstPerson();

		this.needsReset = true;

		if (this.characterOrientation) this.characterOrientation.Enabled = false;

		const humanoid = this.GetHumanoid();

		if (humanoid) humanoid.AutoRotate = this.savedAutoRotate;
	}
}