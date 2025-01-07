import { Players, Workspace } from "@rbxts/services";
import { dict } from "CORP/shared/Libraries/Utilities";
import { FlagUtil } from "../FlagUtil";
import { BaseCamera } from "./BaseCamera";
import { CameraInput } from "./CameraInput";
import { CameraUtils } from "./CameraUtils";

// Local private variables and constants
const UNIT_Z = new Vector3(0, 0, 1);
const X1_Y0_Z1 = new Vector3(1, 0, 1);	// Note: not a unit vector, used for projecting onto XZ plane
const ZERO_VECTOR3 = new Vector3(0, 0, 0);
const TAU = 2 * math.pi;

// Do not edit these values, they are not the developer-set limits, they are limits
// to the values the camera system equations can correctly handle
const MIN_ALLOWED_ELEVATION_DEG = -80;
const MAX_ALLOWED_ELEVATION_DEG = 80;

const FFlagUserFixOrbitalCam = FlagUtil.getUserFlag("UserFixOrbitalCam");

export interface OrbitalCameraExternalProperties {
	"InitialDistance": number
	"MinDistance": number
	"MaxDistance": number
	"InitialElevation": number
	"MinElevation": number
	"MaxElevation": number
	/**
	 * Angle around the Y axis where the camera starts. - 45 offsets the camera in the - X and + Z directions equally
	 */
	"ReferenceAzimuth": number
	/**
	 * How many degrees the camera is allowed to rotate from the reference position, CW as seen from above
	 */
	"CWAzimuthTravel": number
	/**
	 * How many degrees the camera is allowed to rotate from the reference position, CCW as seen from above
	 */
	"CCWAzimuthTravel": number
	/**
	 * Full rotation around Y axis available by default
	 */
	"UseAzimuthLimits": boolean
}

const DefaultOrbitalCameraExternalProperties: OrbitalCameraExternalProperties = {
	InitialDistance: 25,
	MinDistance: 10,
	MaxDistance: 100,
	InitialElevation: 35,
	MinElevation: 35,
	MaxElevation: 35,
	ReferenceAzimuth: -45,
	CWAzimuthTravel: 90,
	CCWAzimuthTravel: 90,
	UseAzimuthLimits: false
};

/**
 * OrbitalCamera - Spherical coordinates control camera for top-down games
 * 2018 Camera Update - AllYourBlox
 */
export class OrbitalCamera extends BaseCamera {
	lastUpdate = tick();

	// OrbitalCamera-specific members
	changedSignalConnections = new Map<keyof OrbitalCameraExternalProperties, RBXScriptConnection>();
	refAzimuthRad: undefined;
	curAzimuthRad: number = 0;
	minAzimuthAbsoluteRad: number = 0;
	maxAzimuthAbsoluteRad: number = 0;
	useAzimuthLimits: boolean | undefined;
	curElevationRad: number = 0;
	minElevationRad: number = 0;
	maxElevationRad: number = 0;
	curDistance: number = 0;
	minDistance: number = 0;
	maxDistance: number = 0;

	gamepadDollySpeedMultiplier = 1;

	lastUserPanCamera = tick();

	externalProperties = DefaultOrbitalCameraExternalProperties;

	constructor() {
		super();

		this.LoadNumberValueParameters();
	}

	LoadOrCreateNumberValueParameter(name: keyof OrbitalCameraExternalProperties, valueType: "StringValue" | "NumberValue" | "BoolValue", updateFunction?: (camera: OrbitalCamera) => void) {
		let valueObj = script.FindFirstChild(name) as StringValue | NumberValue | undefined;

		if (valueObj && valueObj.IsA(valueType)) {
			// Value object exists and is the correct type, use its value
			(this.externalProperties as dict)[name] = valueObj.Value as OrbitalCameraExternalProperties[typeof name];
		} else if (this.externalProperties[name] !== undefined) {
			// Create missing (or replace incorrectly-typed) valueObject with default value
			valueObj = new Instance(valueType) as StringValue;
			valueObj.Name = name;
			valueObj.Parent = script;
			valueObj.Value = this.externalProperties[name] as unknown as string;
		} else {
			return;
		}

		if (updateFunction) {
			this.changedSignalConnections.get(name)?.Disconnect();

			this.changedSignalConnections.set(name, valueObj.Changed.Connect((newValue) => {
				(this.externalProperties as dict)[name] = newValue;
				updateFunction(this);
			}));
		}
	}

	SetAndBoundsCheckAzimuthValues() {
		this.minAzimuthAbsoluteRad = math.rad(this.externalProperties.ReferenceAzimuth) - math.abs(math.rad(this.externalProperties.CWAzimuthTravel));
		this.maxAzimuthAbsoluteRad = math.rad(this.externalProperties.ReferenceAzimuth) + math.abs(math.rad(this.externalProperties.CCWAzimuthTravel));
		this.useAzimuthLimits = this.externalProperties.UseAzimuthLimits;

		if (this.useAzimuthLimits) {
			this.curAzimuthRad = math.clamp(this.curAzimuthRad ?? 0, this.minAzimuthAbsoluteRad, this.maxAzimuthAbsoluteRad);
		}
	}

	SetAndBoundsCheckElevationValues() {
		// These degree values are the direct user input values. It is deliberate that they are
		// ranged checked only against the extremes, and not against each other. Any time one
		// is changed, both of the internal values in radians are recalculated. This allows for
		// A developer to change the values in any order and for the end results to be that the
		// internal values adjust to match intent as best as possible.
		const minElevationDeg = math.max(this.externalProperties.MinElevation, MIN_ALLOWED_ELEVATION_DEG);
		const maxElevationDeg = math.max(this.externalProperties.MaxElevation, MAX_ALLOWED_ELEVATION_DEG);

		// Set internal values in radians
		this.minElevationRad = math.rad(math.min(minElevationDeg, maxElevationDeg));
		this.maxElevationRad = math.rad(math.max(minElevationDeg, maxElevationDeg));
		this.curElevationRad = math.clamp(this.curElevationRad ?? 0, this.minElevationRad, this.maxElevationRad);
	}

	SetAndBoundsCheckDistanceValues() {
		this.minDistance = this.externalProperties.MinDistance;
		this.maxDistance = this.externalProperties.MaxDistance;
		this.curDistance = math.clamp(this.curDistance ?? 0, this.minDistance ?? 0, this.maxDistance ?? 0);
	}

	// This loads from, or lazily creates, NumberValue objects for exposed parameters
	LoadNumberValueParameters() {
		// These initial values do not require change listeners since they are read only once
		this.LoadOrCreateNumberValueParameter("InitialElevation", "NumberValue", undefined);
		this.LoadOrCreateNumberValueParameter("InitialDistance", "NumberValue", undefined);

		// Note: ReferenceAzimuth is also used as an initial value, but needs a change listener because it is used in the calculation of the limits
		this.LoadOrCreateNumberValueParameter("ReferenceAzimuth", "NumberValue", () => this.SetAndBoundsCheckAzimuthValues());
		this.LoadOrCreateNumberValueParameter("CWAzimuthTravel", "NumberValue", () => this.SetAndBoundsCheckAzimuthValues());
		this.LoadOrCreateNumberValueParameter("CCWAzimuthTravel", "NumberValue", () => this.SetAndBoundsCheckAzimuthValues());

		this.LoadOrCreateNumberValueParameter("MinElevation", "NumberValue", () => this.SetAndBoundsCheckElevationValues());
		this.LoadOrCreateNumberValueParameter("MaxElevation", "NumberValue", () => this.SetAndBoundsCheckElevationValues());

		this.LoadOrCreateNumberValueParameter("MinDistance", "NumberValue", () => this.SetAndBoundsCheckDistanceValues());
		this.LoadOrCreateNumberValueParameter("MaxDistance", "NumberValue", () => this.SetAndBoundsCheckDistanceValues());

		this.LoadOrCreateNumberValueParameter("UseAzimuthLimits", "BoolValue", () => this.SetAndBoundsCheckAzimuthValues());

		// Internal values set (in radians, from degrees), plus sanitization
		this.curAzimuthRad = math.rad(this.externalProperties.ReferenceAzimuth);
		this.curElevationRad = math.rad(this.externalProperties.InitialElevation);
		this.curDistance = this.externalProperties.InitialDistance;

		this.SetAndBoundsCheckAzimuthValues();
		this.SetAndBoundsCheckElevationValues();
		this.SetAndBoundsCheckDistanceValues();
	}

	GetModuleName() {
		return "OrbitalCamera";
	}

	SetInitialOrientation(humanoid: Humanoid | undefined) {
		if (!humanoid || !humanoid.RootPart) {
			warn(`OrbitalCamera could not set initial orientation due to missing humanoid`);

			return;
		}

		assert(humanoid.RootPart);

		const newDesiredLook = (humanoid.RootPart.CFrame.LookVector.sub(new Vector3(0, 0.23, 0))).Unit;
		let horizontalShift = CameraUtils.GetAngleBetweenXZVectors(newDesiredLook, this.GetCameraLookVector());
		let vertShift = math.asin(this.GetCameraLookVector().Y) - math.asin(newDesiredLook.Y);

		if (!CameraUtils.IsFinite(horizontalShift)) horizontalShift = 0;
		if (!CameraUtils.IsFinite(vertShift)) vertShift = 0;
	}

	// Functions of BaseCamera that are overridden by OrbitalCamera
	/**
	 * @override
	 */
	GetCameraToSubjectDistance() {
		return this.curDistance as number;
	}

	/**
	 * @override
	 */
	SetCameraToSubjectDistance(desiredSubjectDistance: number) {
		const player = Players.LocalPlayer;

		if (player) {
			this.currentSubjectDistance = math.clamp(desiredSubjectDistance, this.minDistance as number, this.maxDistance as number);

			// OrbitalCamera not allowed to go into the first-person range
			this.currentSubjectDistance = math.max(this.currentSubjectDistance, OrbitalCamera.FIRST_PERSON_DISTANCE_THRESHOLD);
		}

		this.inFirstPerson = false;
		this.UpdateMouseBehavior();

		return this.currentSubjectDistance;
	}

	/**
	 * @override
	 */
	CalculateNewLookVector(suppliedLookVector: Vector3, xyRotateVector: Vector2): Vector3 {
		const currLookVector: Vector3 = suppliedLookVector ?? this.GetCameraLookVector();
		const currPitchAngle: number = math.asin(currLookVector.Y);
		const yTheta: number = math.clamp(xyRotateVector.Y, currPitchAngle - math.rad(MAX_ALLOWED_ELEVATION_DEG), currPitchAngle - math.rad(MIN_ALLOWED_ELEVATION_DEG));
		const constrainedRotateInput: Vector2 = new Vector2(xyRotateVector.X, yTheta);
		const startCFrame: CFrame = new CFrame(Vector3.zero, currLookVector);
		const newLookVector: Vector3 = (CFrame.Angles(0, -constrainedRotateInput.X, 0).mul(startCFrame.mul(CFrame.Angles(-constrainedRotateInput.Y, 0, 0)))).LookVector;

		return newLookVector;
	}

	Update(dt: number): LuaTuple<[CFrame, CFrame]> {
		const now = tick();
		const timeDelta = (now - this.lastUpdate);
		const userPanningTheCamera = CameraInput.getRotation(FFlagUserFixOrbitalCam ? dt : (undefined as unknown as number)) !== new Vector2();
		const camera = Workspace.CurrentCamera as Camera;

		this.StepZoom();

		let newCameraCFrame = camera.CFrame;
		let newCameraFocus = camera.Focus;

		const player = Players.LocalPlayer;
		const cameraSubject = camera && camera.CameraSubject;
		const isInVehicle = cameraSubject && cameraSubject.IsA('VehicleSeat');
		const isOnASkateboard = cameraSubject && cameraSubject.IsA('SkateboardPlatform');

		if (this.lastUpdate === undefined || timeDelta > 1) {
			this.lastCameraTransform = undefined;
		}

		// Reset tween speed if (user is panning
		if (userPanningTheCamera) {
			this.lastUserPanCamera = tick();
		}

		const subjectPosition = this.GetSubjectPosition();

		if (subjectPosition && player && camera) {

			// Process any dollying being done by gamepad
			// TODO: Move this
			if (this.gamepadDollySpeedMultiplier !== 1) {
				this.SetCameraToSubjectDistance(this.currentSubjectDistance * this.gamepadDollySpeedMultiplier);
			}

			newCameraFocus = new CFrame(subjectPosition);

			const flaggedRotateInput = CameraInput.getRotation(dt);

			// rotateInput is a Vector2 of mouse movement deltas since last update
			this.curAzimuthRad = this.curAzimuthRad - flaggedRotateInput.X;

			if (this.useAzimuthLimits) {
				this.curAzimuthRad = math.clamp(this.curAzimuthRad, this.minAzimuthAbsoluteRad, this.maxAzimuthAbsoluteRad);
			} else {
				this.curAzimuthRad = (this.curAzimuthRad !== 0) ? (math.sign(this.curAzimuthRad) * (math.abs(this.curAzimuthRad) % TAU)) : 0;
			}

			this.curElevationRad = math.clamp(this.curElevationRad + flaggedRotateInput.Y, this.minElevationRad, this.maxElevationRad);

			const cameraPosVector = CFrame.fromEulerAnglesYXZ(-this.curElevationRad, this.curAzimuthRad, 0).mul(UNIT_Z as Vector3).mul(this.currentSubjectDistance);
			const camPos = subjectPosition.add(cameraPosVector);

			newCameraCFrame = new CFrame(camPos, subjectPosition);

			this.lastCameraTransform = newCameraCFrame;
			this.lastCameraFocus = newCameraFocus;

			if ((isInVehicle || isOnASkateboard) && cameraSubject.IsA('BasePart')) {
				this.lastSubjectCFrame = cameraSubject.CFrame;
			} else {
				this.lastSubjectCFrame = undefined;
			}
		}

		this.lastUpdate = now;
		return $tuple(newCameraCFrame, newCameraFocus);
	}
}