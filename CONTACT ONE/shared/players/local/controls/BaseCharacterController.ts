import { ConnectionUtil } from "../ConnectionUtil";
import { PlayerModule } from "../PlayerModule";

/**
 * Abstract base class for character controllers, not intended to be directly instantiated.
 */
export abstract class BaseCharacterController {
	public enabled = false;
	protected moveVector = Vector3.zero;
	protected moveVectorIsCameraRelative = true;
	protected isJumping = false;
	protected _connectionUtil = new ConnectionUtil();

	protected playerModule: PlayerModule;

	GetMoveVector(): Vector3 {
		return this.moveVector;
	}

	IsMoveVectorCameraRelative(): boolean {
		return this.moveVectorIsCameraRelative;
	}

	GetIsJumping(): boolean {
		return this.isJumping;
	}

	constructor(playerModule: PlayerModule) {
		this.playerModule = playerModule;
	}

	/**
	 * Override in derived classes to set this.enabled and return boolean indicating
	 * whether Enable/Disable was successful. Return true if controller is already in the requested state. 
	 */
	abstract Enable(enable: boolean, uiParentFrame?: Frame): boolean
}