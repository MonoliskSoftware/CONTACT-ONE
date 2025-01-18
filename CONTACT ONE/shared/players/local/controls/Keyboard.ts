import { ContextActionService, UserInputService } from "@rbxts/services";
import { PlayerModule } from "../PlayerModule";
import { BaseCharacterController } from "./BaseCharacterController";

export class Keyboard extends BaseCharacterController {
	readonly CONTROL_ACTION_PRIORITY: number;

	forwardValue = 0;
	backwardValue = 0;
	leftValue = 0;
	rightValue = 0;

	jumpEnabled = true;
	jumpRequested = false;

	constructor(playerModule: PlayerModule, CONTROL_ACTION_PRIORITY: number) {
		super(playerModule);

		this.CONTROL_ACTION_PRIORITY = CONTROL_ACTION_PRIORITY;
	}

	Enable(enable: boolean) {
		// Module is already in the state being requested. True is returned here since the module will be in the state
		// expected by the code that follows the Enable() call. This makes more sense than returning false to indicate
		// no action was necessary. False indicates failure to be in requested/expected state.
		if (enable === this.enabled) return true;

		this.forwardValue = 0;
		this.backwardValue = 0;
		this.leftValue = 0;
		this.rightValue = 0;
		this.moveVector = Vector3.zero;
		this.jumpRequested = false;
		this.UpdateJump();

		if (enable) {
			this.BindContextActions();
			this.ConnectFocusEventListeners();
		} else {
			this._connectionUtil.disconnectAll();
		}

		this.enabled = enable;

		return true;
	}

	UpdateMovement(inputState: Enum.UserInputState) {
		if (inputState === Enum.UserInputState.Cancel) {
			this.moveVector = Vector3.zero;
		} else {
			this.moveVector = new Vector3(this.leftValue + this.rightValue, 0, this.forwardValue + this.backwardValue);
		}
	}

	UpdateJump() {
		this.isJumping = this.jumpRequested;
	}

	BindContextActions() {
		// Note: In the previous version of this code, the movement values were not zeroed-out on UserInputState. Cancel, now they are,
		// which fixes them from getting stuck on.
		// We return ContextActionResult.Pass here for legacy reasons.
		// Many games rely on gameProcessedEvent being false on UserInputService.InputBegan for these control actions.

		const handleMoveForward = (actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => {
			this.forwardValue = (inputState === Enum.UserInputState.Begin) ? - 1 : 0;
			this.UpdateMovement(inputState);

			return Enum.ContextActionResult.Pass;
		};

		const handleMoveBackward = (actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => {
			this.backwardValue = (inputState === Enum.UserInputState.Begin) ? 1 : 0;
			this.UpdateMovement(inputState);

			return Enum.ContextActionResult.Pass;
		};

		const handleMoveLeft = (actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => {
			this.leftValue = (inputState === Enum.UserInputState.Begin) ? - 1 : 0;
			this.UpdateMovement(inputState);

			return Enum.ContextActionResult.Pass;
		};

		const handleMoveRight = (actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => {
			this.rightValue = (inputState === Enum.UserInputState.Begin) ? 1 : 0;
			this.UpdateMovement(inputState);

			return Enum.ContextActionResult.Pass;
		};

		const handleJumpAction = (actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => {
			this.jumpRequested = this.jumpEnabled && (inputState === Enum.UserInputState.Begin);
			this.UpdateJump();

			return Enum.ContextActionResult.Pass;
		};

		// TODO: Revert to KeyCode bindings so that in the future the abstraction layer from actual keys to
		// movement direction is done in Lua
		ContextActionService.BindActionAtPriority("moveForwardAction", handleMoveForward, false,
			this.CONTROL_ACTION_PRIORITY, Enum.PlayerActions.CharacterForward);
		ContextActionService.BindActionAtPriority("moveBackwardAction", handleMoveBackward, false,
			this.CONTROL_ACTION_PRIORITY, Enum.PlayerActions.CharacterBackward);
		ContextActionService.BindActionAtPriority("moveLeftAction", handleMoveLeft, false,
			this.CONTROL_ACTION_PRIORITY, Enum.PlayerActions.CharacterLeft);
		ContextActionService.BindActionAtPriority("moveRightAction", handleMoveRight, false,
			this.CONTROL_ACTION_PRIORITY, Enum.PlayerActions.CharacterRight);
		ContextActionService.BindActionAtPriority("jumpAction", handleJumpAction, false,
			this.CONTROL_ACTION_PRIORITY, Enum.PlayerActions.CharacterJump);

		this._connectionUtil.trackBoundFunction("moveForwardAction", () => ContextActionService.UnbindAction("moveForwardAction"));
		this._connectionUtil.trackBoundFunction("moveBackwardAction", () => ContextActionService.UnbindAction("moveBackwardAction"));
		this._connectionUtil.trackBoundFunction("moveLeftAction", () => ContextActionService.UnbindAction("moveLeftAction"));
		this._connectionUtil.trackBoundFunction("moveRightAction", () => ContextActionService.UnbindAction("moveRightAction"));
		this._connectionUtil.trackBoundFunction("jumpAction", () => ContextActionService.UnbindAction("jumpAction"));
	}

	ConnectFocusEventListeners() {
		const onFocusReleased = () => {
			this.moveVector = Vector3.zero;
			this.forwardValue = 0;
			this.backwardValue = 0;
			this.leftValue = 0;
			this.rightValue = 0;
			this.jumpRequested = false;
			this.UpdateJump();
		};

		const onTextFocusGained = (textboxFocused: TextBox) => {
			this.jumpRequested = false;
			this.UpdateJump();
		};

		this._connectionUtil.trackConnection("textBoxFocusReleased", UserInputService.TextBoxFocusReleased.Connect(onFocusReleased));
		this._connectionUtil.trackConnection("textBoxFocused", UserInputService.TextBoxFocused.Connect(onTextFocusGained));
		this._connectionUtil.trackConnection("windowFocusReleased", UserInputService.WindowFocused.Connect(onFocusReleased));
	}
}