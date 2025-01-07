import { Players, Workspace } from "@rbxts/services";
import { FlagUtil } from "../FlagUtil";
import { BaseCamera } from "./BaseCamera";
import { CameraInput } from "./CameraInput";
import { CameraUtils } from "./CameraUtils";

let tweenSpeed = math.rad(0);          // Radians/Second
const tweenAcceleration = math.rad(220); // Radians/Second^2
const tweenMaxSpeed = math.rad(250);     // Radians/Second

const INITIAL_CAMERA_ANGLE = CFrame.fromOrientation(math.rad(-15), 0, 0);
const TIME_BEFORE_AUTO_ROTATE = 2;       // Seconds, used when auto-aligning camera with vehicles

const FFlagUserCameraInputDt = FlagUtil.getUserFlag("UserCameraInputDt");
const FFlagUserFixCameraOffsetJitter = FlagUtil.getUserFlag("UserFixCameraOffsetJitter2");
const FFlagUserFixCameraFPError = FlagUtil.getUserFlag("UserFixCameraFPError");

export class ClassicCamera extends BaseCamera {
	isFollowCamera = false;
	lastUpdate = tick();
	cameraToggleSpring = new CameraUtils.Spring(5, 0);

	Update(dt: number) {
		const now = tick();
		let timeDelta = now - this.lastUpdate; // replace with dt if FFlagUserCameraInputDt

		if (FFlagUserCameraInputDt) timeDelta = dt;

		const camera = Workspace.CurrentCamera as Camera;
		let newCameraCFrame = camera.CFrame;
		let newCameraFocus = camera.Focus;

		let overrideCameraLookVector = undefined;

		if (this.resetCameraAngle) {
			const rootPart: BasePart = this.GetHumanoidRootPart();

			if (rootPart) {
				overrideCameraLookVector = (rootPart.CFrame.mul(INITIAL_CAMERA_ANGLE)).LookVector;
			} else {
				overrideCameraLookVector = INITIAL_CAMERA_ANGLE.LookVector;
			}

			this.resetCameraAngle = false;
		}

		const player = Players.LocalPlayer;
		const humanoid = this.GetHumanoid();
		const cameraSubject = camera.CameraSubject;
		const isInVehicle = cameraSubject && cameraSubject.IsA("VehicleSeat");
		const isOnASkateboard = cameraSubject && cameraSubject.IsA("SkateboardPlatform");
		const isClimbing = humanoid && humanoid.GetState() === Enum.HumanoidStateType.Climbing;

		if (this.lastUpdate === undefined || timeDelta > 1) {
			this.lastCameraTransform = undefined;
		}

		let rotateInput = CameraInput.getRotation(timeDelta);

		this.StepZoom();

		const cameraHeight = this.GetCameraHeight();

		// Reset tween speed if( user is panning
		if (rotateInput !== new Vector2()) {
			tweenSpeed = 0;
			this.lastUserPanCamera = tick();
		}

		const userRecentlyPannedCamera = now - this.lastUserPanCamera < TIME_BEFORE_AUTO_ROTATE;

		let subjectPosition: Vector3 | undefined = this.GetSubjectPosition();

		if (subjectPosition && player && camera) {
			let zoom = this.GetCameraToSubjectDistance();

			if (zoom < 0.5) {
				zoom = 0.5;
			}

			if (this.GetIsMouseLocked() && !this.IsInFirstPerson()) {
				// We need to use the right vector of the camera after rotation, not before
				const newLookCFrame: CFrame = this.CalculateNewLookCFrameFromArg(overrideCameraLookVector, rotateInput);

				let offset: Vector3 = this.GetMouseLockOffset();

				if (FFlagUserFixCameraOffsetJitter) {
					// in mouse lock mode, the offset is applied to the camera instead of to the subject position
					if (humanoid) {
						offset = offset.add(humanoid.CameraOffset);
					}
				}

				const cameraRelativeOffset: Vector3 = newLookCFrame.RightVector.mul(offset.X).add(newLookCFrame.UpVector.mul(offset.Y).add(newLookCFrame.LookVector.mul(offset.Z)));

				//offset can be NAN, NAN, NAN if( newLookVector has only y component
				if (CameraUtils.IsFiniteVector3(cameraRelativeOffset)) {
					subjectPosition = subjectPosition.add(cameraRelativeOffset);
				}
			} else {
				const userPanningTheCamera = rotateInput !== new Vector2();

				if (!userPanningTheCamera && this.lastCameraTransform) {
					const isInFirstPerson = this.IsInFirstPerson();

					if ((isInVehicle || isOnASkateboard || (this.isFollowCamera && isClimbing)) && this.lastUpdate !== undefined && humanoid && humanoid.Torso) {
						if (isInFirstPerson) {
							if (this.lastSubjectCFrame && (isInVehicle || isOnASkateboard) && cameraSubject.IsA("BasePart")) {
								const y = -CameraUtils.GetAngleBetweenXZVectors(this.lastSubjectCFrame.LookVector, cameraSubject.CFrame.LookVector);

								if (CameraUtils.IsFinite(y)) {
									rotateInput = rotateInput.add(new Vector2(y, 0));
								}

								tweenSpeed = 0;
							}
						} else if (!userRecentlyPannedCamera) {
							const forwardVector = humanoid.Torso.CFrame.LookVector;
							tweenSpeed = math.clamp(tweenSpeed + tweenAcceleration * timeDelta, 0, tweenMaxSpeed);

							let percent = math.clamp(tweenSpeed * timeDelta, 0, 1);
							// NOTE: initial def had self.isClimbing
							if (this.IsInFirstPerson() && !(this.isFollowCamera && isClimbing)) {
								percent = 1;
							}

							const y = CameraUtils.GetAngleBetweenXZVectors(forwardVector, this.GetCameraLookVector());
							if (CameraUtils.IsFinite(y) && math.abs(y) > 0.0001) {
								rotateInput = rotateInput.add(new Vector2(y * percent, 0));
							}
						}

					} else if (this.isFollowCamera && !(isInFirstPerson || userRecentlyPannedCamera)) {
						// Logic that was unique to the old FollowCamera module
						const lastVec = (this.lastCameraTransform.Position.sub(subjectPosition)).mul(-1);

						const y = CameraUtils.GetAngleBetweenXZVectors(lastVec, this.GetCameraLookVector());

						// This cutoff is to decide if( the humanoid's angle of movement,
						// relative to the camera's look vector, is enough that
						// we want the camera to be following them. The point is to provide
						// a sizable dead zone to allow more precise forward movements.
						const thetaCutoff = 0.4;

						// Check for NaNs
						if (CameraUtils.IsFinite(y) && math.abs(y) > 0.0001 && math.abs(y) > thetaCutoff * timeDelta) {
							rotateInput = rotateInput.add(new Vector2(y, 0));
						}
					}
				}
			}

			if (!this.isFollowCamera) {
				newCameraFocus = new CFrame(subjectPosition);

				const cameraFocusP = newCameraFocus.Position;
				const newLookVector = this.CalculateNewLookVectorFromArg(overrideCameraLookVector, rotateInput);

				if (FFlagUserFixCameraFPError) {
					newCameraCFrame = CFrame.lookAlong(cameraFocusP.sub(newLookVector.mul(zoom)), newLookVector);
				} else {
					newCameraCFrame = new CFrame(cameraFocusP.sub(newLookVector.mul(zoom)), cameraFocusP);
				}
			} else { // is FollowCamera
				const newLookVector = this.CalculateNewLookVectorFromArg(overrideCameraLookVector, rotateInput);

				newCameraFocus = new CFrame(subjectPosition);

				if (FFlagUserFixCameraFPError) {
					newCameraCFrame = CFrame.lookAlong(newCameraFocus.Position.sub(newLookVector.mul(zoom)), newLookVector);
				} else {
					newCameraCFrame = new CFrame(newCameraFocus.Position.sub(newLookVector.mul(zoom)), newCameraFocus.Position).add(new Vector3(0, cameraHeight, 0));
				}
			}

			const toggleOffset = this.GetCameraToggleOffset(timeDelta);
			newCameraFocus = newCameraFocus.add(toggleOffset);
			newCameraCFrame = newCameraCFrame.add(toggleOffset);

			this.lastCameraTransform = newCameraCFrame;
			this.lastCameraFocus = newCameraFocus;

			if ((isInVehicle || isOnASkateboard) && cameraSubject.IsA("BasePart")) {
				this.lastSubjectCFrame = cameraSubject.CFrame;
			} else {
				this.lastSubjectCFrame = undefined;
			}
		}

		this.lastUpdate = now;

		return $tuple(newCameraCFrame, newCameraFocus);
	}

	GetCameraToggleOffset(dt: number) {
		if (this.isCameraToggle) {
			const zoom = this.currentSubjectDistance;

			if (CameraInput.getTogglePan()) {
				this.cameraToggleSpring.goal = math.clamp(CameraUtils.map(zoom, 0.5, ClassicCamera.FIRST_PERSON_DISTANCE_THRESHOLD, 0, 1), 0, 1);
			} else {
				this.cameraToggleSpring.goal = 0;
			}

			const distanceOffset: number = math.clamp(CameraUtils.map(zoom, 0.5, 64, 0, 1), 0, 1) + 1;

			return new Vector3(0, this.cameraToggleSpring.step(dt) * distanceOffset, 0);
		}

		return Vector3.zero;
	}

	GetModuleName(): string {
		return "ClassicCamera";
	}
}