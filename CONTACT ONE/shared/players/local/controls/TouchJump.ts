import { GuiService, Players } from "@rbxts/services";
import { CharacterUtil } from "../CharacterUtil";
import { FlagUtil } from "../FlagUtil";
import { PlayerModule } from "../PlayerModule";
import { BaseCharacterController } from "./BaseCharacterController";

const FFlagUserUpdateTouchJump = FlagUtil.getUserFlag("UserUpdateTouchJump2");

const CONNECTIONS = {
	HUMANOID_STATE_ENABLED_CHANGED: "HUMANOID_STATE_ENABLED_CHANGED",
	HUMANOID_JUMP_POWER: "HUMANOID_JUMP_POWER",
	HUMANOID: "HUMANOID",
	JUMP_INPUT_ENDED: "JUMP_INPUT_ENDED",
	MENU_OPENED: "MENU_OPENED",
};

const TOUCH_CONTROL_SHEET = "rbxasset://textures/ui/Input/TouchControlsSheetV2.png";

export class TouchJump extends BaseCharacterController {
	parentUIFrame: Frame | undefined;
	jumpButton: ImageButton | undefined;

	/**
	 * @Kdeprecated remove with FFlagUserUpdateTouchJump
	 */
	characterAddedConn: RBXScriptConnection | undefined;
	/**
	 * @Kdeprecated remove with FFlagUserUpdateTouchJump
	 */
	humanoidStateEnabledChangedConn: RBXScriptConnection | undefined;
	/**
	 * @Kdeprecated remove with FFlagUserUpdateTouchJump
	 */
	humanoidJumpPowerConn: RBXScriptConnection | undefined;
	/**
	 * @Kdeprecated remove with FFlagUserUpdateTouchJump
	 */
	humanoidParentConn: RBXScriptConnection | undefined;
	/**
	 * @Kdeprecated remove with FFlagUserUpdateTouchJump
	 */
	jumpPower: number = 0;
	/**
	 * @Kdeprecated remove with FFlagUserUpdateTouchJump
	 */
	jumpStateEnabled: boolean | undefined = FFlagUserUpdateTouchJump ? true : undefined;
	/**
	 * saved reference because property change connections are made using it
	 * @Kdeprecated remove with FFlagUserUpdateTouchJump
	 */
	humanoid: Humanoid | undefined;

	humanoidChangedConn: RBXScriptConnection | undefined;
	absoluteSizeChangedConn: RBXScriptConnection | undefined;

	externallyEnabled = false;
	_active = FFlagUserUpdateTouchJump ? false : undefined;

	touchObject: InputObject | undefined;

	constructor(playerModule: PlayerModule) {
		super(playerModule);

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
		const humanoidConnection = CharacterUtil.onChild("Humanoid", "Humanoid", humanoid => {
			assert(humanoid.IsA("Humanoid"));

			update();

			this._connectionUtil.trackConnection(
				CONNECTIONS.HUMANOID_JUMP_POWER,
				humanoid.GetPropertyChangedSignal("JumpPower").Connect(() => update())
			);

			this._connectionUtil.trackConnection(
				CONNECTIONS.HUMANOID_STATE_ENABLED_CHANGED,
				humanoid.StateEnabledChanged.Connect(() => update())
			);
		});

		this._connectionUtil.trackConnection(CONNECTIONS.HUMANOID, humanoidConnection);
	}

	UpdateEnabled() {
		if (FFlagUserUpdateTouchJump) {
			const humanoid = CharacterUtil.getChild("Humanoid", "Humanoid");

			assert(humanoid?.IsA("Humanoid"));

			if (humanoid && this.externallyEnabled && humanoid.JumpPower > 0 && humanoid.GetStateEnabled(Enum.HumanoidStateType.Jumping))
				this.EnableButton(true); else
				this.EnableButton(false);
		} else {
			if (this.jumpPower > 0 && this.jumpStateEnabled)
				this.EnableButton(true); else
				this.EnableButton(false);
		}
	}

	HumanoidChanged(property: InstancePropertyNames<Humanoid>) {
		assert(!FFlagUserUpdateTouchJump);

		const humanoid = Players.LocalPlayer.Character && Players.LocalPlayer.Character.FindFirstChildOfClass("Humanoid");

		if (humanoid) {
			if (property === "JumpPower") {
				this.jumpPower = humanoid.JumpPower;
				this.UpdateEnabled();
			} else if (property === "Parent" && !humanoid.Parent) this.humanoidChangedConn?.Disconnect();
		}
	}

	HumanoidStateEnabledChanged(state: Enum.HumanoidStateType, isEnabled: boolean) {
		assert(!FFlagUserUpdateTouchJump);

		if (state === Enum.HumanoidStateType.Jumping) {
			this.jumpStateEnabled = isEnabled;
			this.UpdateEnabled();
		}
	}

	CharacterAdded(character: Model) {
		assert(!FFlagUserUpdateTouchJump);

		this.humanoidChangedConn?.Disconnect();
		this.humanoidChangedConn = undefined;

		this.humanoid = character.FindFirstChildOfClass("Humanoid");

		while (!this.humanoid) {
			character.ChildAdded.Wait();
			this.humanoid = character.FindFirstChildOfClass("Humanoid");
		}

		this.humanoidJumpPowerConn = this.humanoid.GetPropertyChangedSignal("JumpPower").Connect(() => {
			assert(this.humanoid);

			this.jumpPower = this.humanoid.JumpPower;
		});

		this.humanoidParentConn = this.humanoid.GetPropertyChangedSignal("Parent").Connect(() => {
			if (!this.humanoid?.Parent) {
				this.humanoidJumpPowerConn?.Disconnect();
				this.humanoidJumpPowerConn = undefined;
				this.humanoidParentConn?.Disconnect();
				this.humanoidParentConn = undefined;
			}
		});

		this.humanoidStateEnabledChangedConn = this.humanoid.StateEnabledChanged.Connect((state, enabled) => this.HumanoidStateEnabledChanged(state, enabled));

		this.jumpPower = this.humanoid.JumpPower;
		this.jumpStateEnabled = this.humanoid.GetStateEnabled(Enum.HumanoidStateType.Jumping);
		this.UpdateEnabled();
	}

	SetupCharacterAddedFunction() {
		assert(!FFlagUserUpdateTouchJump);

		this.characterAddedConn = Players.LocalPlayer.CharacterAdded.Connect(character => this.CharacterAdded(character));

		if (Players.LocalPlayer.Character) this.CharacterAdded(Players.LocalPlayer.Character);
	}

	EnableButton(enable: boolean) {
		if (FFlagUserUpdateTouchJump) {
			if (enable === this._active) return;

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
						if (this.touchObject) this._reset();
					})
				);
			} else {
				if (this.jumpButton) this.jumpButton.Visible = false;

				this._connectionUtil.disconnect(CONNECTIONS.JUMP_INPUT_ENDED);
				this._connectionUtil.disconnect(CONNECTIONS.MENU_OPENED);
			}

			this._reset();
			this._active = enable;
		} else {
			if (enable) {
				if (!this.jumpButton) this.Create();

				assert(this.jumpButton);

				const humanoid = Players.LocalPlayer.Character && Players.LocalPlayer.Character.FindFirstChildOfClass("Humanoid");

				if (humanoid && this.externallyEnabled && humanoid.JumpPower > 0) this.jumpButton.Visible = true;
			} else {
				assert(this.jumpButton);

				this.jumpButton.Visible = false;
				this.touchObject = undefined;
				this.isJumping = false;
				this.jumpButton.ImageRectOffset = new Vector2(1, 146);
			}
		}
	}

	Enable(enable: boolean, parentFrame?: Frame) {
		if (parentFrame) this.parentUIFrame = parentFrame;

		this.externallyEnabled = enable;

		if (FFlagUserUpdateTouchJump) {
			this.UpdateEnabled();

			if (enable) this._setupConfigurations(); else this._connectionUtil.disconnectAll();
		} else this.EnableButton(enable);

		return false;
	}

	Create() {
		if (!this.parentUIFrame) return;

		this.jumpButton?.Destroy();
		this.jumpButton = undefined;

		this.absoluteSizeChangedConn?.Disconnect();
		this.absoluteSizeChangedConn = undefined;

		this.jumpButton = new Instance("ImageButton");
		this.jumpButton.Name = "JumpButton";
		this.jumpButton.Visible = false;
		this.jumpButton.BackgroundTransparency = 1;
		this.jumpButton.Image = TOUCH_CONTROL_SHEET;
		this.jumpButton.ImageRectOffset = new Vector2(1, 146);
		this.jumpButton.ImageRectSize = new Vector2(144, 144);

		const ResizeJumpButton = () => {
			assert(this.parentUIFrame);
			assert(this.jumpButton);

			const minAxis = math.min(this.parentUIFrame.AbsoluteSize.X, this.parentUIFrame.AbsoluteSize.Y);
			const isSmallScreen = minAxis <= 500;
			const jumpButtonSize = isSmallScreen ? 70 : 120;

			this.jumpButton.Size = new UDim2(0, jumpButtonSize, 0, jumpButtonSize);
			this.jumpButton.Position = isSmallScreen ? new UDim2(1, -(jumpButtonSize * 1.5 - 10), 1, -jumpButtonSize - 20) :
				new UDim2(1, -(jumpButtonSize * 1.5 - 10), 1, -jumpButtonSize * 1.75);
		};

		ResizeJumpButton();

		this.absoluteSizeChangedConn = this.parentUIFrame.GetPropertyChangedSignal("AbsoluteSize").Connect(() => ResizeJumpButton);

		this.touchObject = undefined;
		this.jumpButton.InputBegan.Connect(inputObject => {
			assert(this.jumpButton);

			//A touch that starts elsewhere on the screen will be sent to a frame's InputBegan event
			//if ( it moves over the frame. So we check that this is actually a new touch (inputObject.UserInputState !== Enum.UserInputState.Begin)
			if (this.touchObject || inputObject.UserInputType !== Enum.UserInputType.Touch
				|| inputObject.UserInputState !== Enum.UserInputState.Begin) return;

			this.touchObject = inputObject;
			this.jumpButton.ImageRectOffset = new Vector2(146, 146);
			this.isJumping = true;
		});

		if (!FFlagUserUpdateTouchJump) {
			const OnInputEnded = () => {
				assert(this.jumpButton);

				this.touchObject = undefined;
				this.isJumping = false;
				this.jumpButton.ImageRectOffset = new Vector2(1, 146);
			};

			this.jumpButton.InputEnded.Connect(inputObject => {
				if (inputObject === this.touchObject) OnInputEnded();
			});

			GuiService.MenuOpened.Connect(() => {
				if (this.touchObject) OnInputEnded();
			});

			if (!this.characterAddedConn) this.SetupCharacterAddedFunction();
		}

		this.jumpButton.Parent = this.parentUIFrame;
	}
}