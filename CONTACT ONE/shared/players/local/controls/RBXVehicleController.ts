import { BaseCharacterController } from "./BaseCharacterController";

// Set this to true if you want to instead use the triggers for the throttle
const useTriggersForThrottle = true;
// Also set this to true if you want the thumbstick to not affect throttle, only triggers when a gamepad is conected
const onlyTriggersForThrottle = false;

export abstract class RBXVehicleController extends BaseCharacterController {
	enabled = false;
	vehicleSeat: VehicleSeat | undefined;
	throttle = 0;
	steer = 0;

	acceleration = 0;
	decceleration = 0;
	turningRight = 0;
	turningLeft = 0;

	vehicleMoveVector = Vector3.zero;

	autoPilot = {
		MaxSpeed: 0,
		MaxSteeringAngle: 0
	};

	readonly CONTROL_ACTION_PRIORITY: number;

	constructor(CONTROL_ACTION_PRIORITY: number) {
		super();

		this.CONTROL_ACTION_PRIORITY = CONTROL_ACTION_PRIORITY;
	}

	BindContextActions() {

	}
}