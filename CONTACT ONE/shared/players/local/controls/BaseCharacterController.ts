import { ConnectionUtil } from "../ConnectionUtil";

/**
 * Abstract base class for character controllers, not intended to be directly instantiated.
 */
export abstract class BaseCharacterController {
	protected enabled = false;
	protected moveVector = Vector3.zero;
	protected moveVectorIsCameraRelative = true;
	protected isJumping = false;
	protected _connectionUtil = new ConnectionUtil();

	GetMoveVector(): Vector3 {
		return this.moveVector;
	}

	IsMoveVectorCameraRelative(): boolean {
		return this.moveVectorIsCameraRelative;
	}

	GetIsJumping(): boolean {
		return this.isJumping;
	}

	/**
	 * Override in derived classes to set this.enabled and return boolean indicating
	 * whether Enable/Disable was successful. Return true if controller is already in the requested state. 
	 */
	abstract Enable(enable: boolean): boolean
}