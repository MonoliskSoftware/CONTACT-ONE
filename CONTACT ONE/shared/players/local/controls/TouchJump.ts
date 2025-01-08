import { FlagUtil } from "../FlagUtil";
import { BaseCharacterController } from "./BaseCharacterController";

const FFlagUserUpdateTouchJump = FlagUtil.getUserFlag("UserUpdateTouchJump2");

export class TouchJump extends BaseCharacterController {
	parentUIFrame: Frame | undefined;
	jumpButton: ImageButton | undefined;

	/**
	 * @deprecated remove with FFlagUserUpdateTouchJump
	 */
	characterAddedConn: RBXScriptConnection | undefined;
	/**
	 * @deprecated remove with FFlagUserUpdateTouchJump
	 */
	humanoidStateEnabledChangedConn: RBXScriptConnection | undefined;
	/**
	 * @deprecated remove with FFlagUserUpdateTouchJump
	 */
	humanoidJumpPowerConn: RBXScriptConnection | undefined;
	/**
	 * @deprecated remove with FFlagUserUpdateTouchJump
	 */
	humanoidParentConn: RBXScriptConnection | undefined;
	/**
	 * @deprecated remove with FFlagUserUpdateTouchJump
	 */
	jumpPower: number | undefined = FFlagUserUpdateTouchJump ? 0 : undefined;
	/**
	 * @deprecated remove with FFlagUserUpdateTouchJump
	 */
	jumpStateEnabled: boolean | undefined = FFlagUserUpdateTouchJump ? true : undefined;
	/**
	 * saved reference because property change connections are made using it
	 * @deprecated remove with FFlagUserUpdateTouchJump
	 */
	humanoid: Humanoid | undefined;

	externallyEnabled = false;
	_active = FFlagUserUpdateTouchJump ? false : undefined;

	touchObject: InputObject | undefined;

	constructor() {
		super();

		this.isJumping = false;
	}

	private _reset() {
		assert(FFlagUserUpdateTouchJump);

		this.isJumping = false;
		this.touchObject = undefined;

		if (this.jumpButton) {
			this.jumpButton.ImageRectOffset = new Vector2(1, 146);
		}
	}

	private _setupConfigurations() {
		assert(FFlagUserUpdateTouchJump);

		const update = () => this.UpdateEnabled();

		// listen to jump APIs on the humanoid
		const humanoidConnection = Charac
	}

	EnableButton(enable: boolean) {
		if (FFlagUserUpdateTouchJump) {
			if (enable === this._active) {
				return;
			}

			if (enable) {
				if (!this.jumpButton) this.Create();

				assert(this.jumpButton);

				this.jumpButton.Visible = true;

				// input connections
				// stop jumping connection
				this._connectionUtil.trackConnection(
					CONNECTIONS.JUMP_INPUT_ENDED,
					this.jumpButton.InputEnded.Connect((inputObject) => {
						if (inputObject === this.touchObject) {
							this._reset();
						}
					})
				);

				// stop jumping on menu open
				this._connectionUtil.trackConnection(
					CONNECTIONS.MENU_OPENED,
					GuiService.MenuOpened.Connect(() => {
						if (this.touchObject) {
							this._reset();
						}
					})
				);
			} else {
				if (this.jumpButton) {
					this.jumpButton.Visible = false;
				}
				this._connectionUtil.disconnect(CONNECTIONS.JUMP_INPUT_ENDED);
				this._connectionUtil.disconnect(CONNECTIONS.MENU_OPENED);
			}
			this._reset();
			this._active = enable;
		} else {
			if (enable) {
				if (!this.jumpButton) this.Create();

				const humanoid = Players.LocalPlayer.Character && Players.LocalPlayer.Character. FindFirstChildOfClass("Humanoid");
				
				if (humanoid && this.externallyEnabled && humanoid.JumpPower > 0) this.jumpButton.Visible = true;
			} else {
				this.jumpButton.Visible = false;
				this.touchObject = undefined;
				this.isJumping = false;
				this.jumpButton.ImageRectOffset = new Vector2(1, 146);
			}
		}
	}
}