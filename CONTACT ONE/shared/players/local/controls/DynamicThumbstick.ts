//!nonstrict

import { ContextActionService, GuiService, Players, RunService, TweenService, UserInputService, Workspace } from "@rbxts/services";
import { FlagUtil } from "../FlagUtil";
import { BaseCharacterController } from "./BaseCharacterController";

//[[ Constants ]]//
const ZERO_VECTOR3 = new Vector3(0, 0, 0);
const TOUCH_CONTROLS_SHEET = "rbxasset://textures/ui/Input/TouchControlsSheetV2.png";

const DYNAMIC_THUMBSTICK_ACTION_NAME = "DynamicThumbstickAction";
const DYNAMIC_THUMBSTICK_ACTION_PRIORITY = Enum.ContextActionPriority.High.Value;

const MIDDLE_TRANSPARENCIES = [
	1 - 0.89,
	1 - 0.70,
	1 - 0.60,
	1 - 0.50,
	1 - 0.40,
	1 - 0.30,
	1 - 0.25
];
const NUM_MIDDLE_IMAGES = MIDDLE_TRANSPARENCIES.size();

const FADE_IN_OUT_BACKGROUND = true;
const FADE_IN_OUT_MAX_ALPHA = 0.35;

const SAFE_AREA_INSET_MAX = 100;

const FADE_IN_OUT_HALF_DURATION_DEFAULT = 0.3;
const FADE_IN_OUT_BALANCE_DEFAULT = 0.5;
const ThumbstickFadeTweenInfo = new TweenInfo(0.15, Enum.EasingStyle.Quad, Enum.EasingDirection.InOut);

const FFlagUserDynamicThumbstickMoveOverButtons = FlagUtil.getUserFlag("UserDynamicThumbstickMoveOverButtons2");
const FFlagUserDynamicThumbstickSafeAreaUpdate = FlagUtil.getUserFlag("UserDynamicThumbstickSafeAreaUpdate");

let LocalPlayer = Players.LocalPlayer;

if (!LocalPlayer && !RunService.IsServer()) {
	Players.GetPropertyChangedSignal("LocalPlayer").Wait();
	LocalPlayer = Players.LocalPlayer;
}

export class DynamicThumbstick extends BaseCharacterController {
	moveTouchObject: InputObject | undefined;
	moveTouchLockedIn = false;
	moveTouchFirstChanged = false;
	moveTouchStartPosition: Vector2 | undefined;

	startImage: ImageLabel | undefined;
	endImage: ImageLabel | undefined;
	middleImages: ImageLabel[] = [];

	startImageFadeTween: Tween | undefined;
	endImageFadeTween: Tween | undefined;
	middleImageFadeTweens: Tween[] = [];

	isFirstTouch = true;

	thumbstickFrame: Frame | undefined;

	onRenderSteppedConn: RBXScriptConnection | undefined;

	fadeInAndOutBalance = FADE_IN_OUT_BALANCE_DEFAULT;
	fadeInAndOutHalfDuration = FADE_IN_OUT_HALF_DURATION_DEFAULT;
	hasFadedBackgroundInPortrait = false;
	hasFadedBackgroundInLandscape = false;

	tweenInAlphaStart: number | undefined;
	tweenOutAlphaStart: number | undefined;

	thumbstickSize = 0;
	thumbstickRingSize = 0;
	middleSize = 0;
	middleSpacing = 0;
	radiusOfDeadZone = 0;
	radiusOfMaxSpeed = 0;

	onTouchEndedConn: RBXScriptConnection | undefined;
	TouchMovedCon: RBXScriptConnection | undefined;
	absoluteSizeChangedConn: RBXScriptConnection | undefined;

	constructor() {
		super();

		return this;
	}

	// Note: Overrides base class GetIsJumping with get-&&-clear behavior to { a single jump
	// rather than sustained jumping. This is only to preserve the current behavior through the refactor.
	GetIsJumping() {
		const wasJumping = this.isJumping;

		this.isJumping = false;

		return wasJumping;
	}

	Enable(enable: boolean | undefined, uiParentFrame?: Frame): boolean {
		if (enable === undefined) return false;			// if (undefined, return false (invalid argument)

		enable = enable ? true : false;				// Force anything non-undefined to boolean before comparison

		if (this.enabled === enable) return true;	// if (no state change, return true indicating already in requested state

		if (enable) {
			// Enable
			if (!this.thumbstickFrame) {
				this.Create(uiParentFrame as Frame);
			}

			this.BindContextActions();
		} else {
			if (FFlagUserDynamicThumbstickMoveOverButtons) {
				this.UnbindContextActions();
			} else {
				ContextActionService.UnbindAction(DYNAMIC_THUMBSTICK_ACTION_NAME);
			}

			// Disable
			this.OnInputEnded(); // Cleanup
		}

		assert(this.thumbstickFrame);

		this.enabled = enable;
		this.thumbstickFrame.Visible = enable;

		return false;
	}

	// Was called OnMoveTouchEnded in previous version
	OnInputEnded() {
		this.moveTouchObject = undefined;
		this.moveVector = ZERO_VECTOR3;
		this.FadeThumbstick(false);
	}

	FadeThumbstick(visible: boolean | undefined) {
		if (!visible && this.moveTouchObject) return;
		if (this.isFirstTouch) return;

		if (this.startImageFadeTween) this.startImageFadeTween.Cancel();
		if (this.endImageFadeTween) this.endImageFadeTween.Cancel();

		this.middleImages.forEach((value, index) => this.middleImageFadeTweens[index]?.Cancel());

		assert(this.startImage);
		assert(this.endImage);

		if (visible) {
			this.startImageFadeTween = TweenService.Create(this.startImage, ThumbstickFadeTweenInfo, { ImageTransparency: 0 });
			this.startImageFadeTween.Play();

			this.endImageFadeTween = TweenService.Create(this.endImage, ThumbstickFadeTweenInfo, { ImageTransparency: 0.2 });
			this.endImageFadeTween.Play();

			this.middleImageFadeTweens = this.middleImages.map((image, index) => TweenService.Create(image, ThumbstickFadeTweenInfo, { ImageTransparency: MIDDLE_TRANSPARENCIES[index] }));
			this.middleImageFadeTweens.forEach(tween => tween.Play());
		} else {
			this.startImageFadeTween = TweenService.Create(this.startImage, ThumbstickFadeTweenInfo, { ImageTransparency: 1 });
			this.startImageFadeTween.Play();

			this.endImageFadeTween = TweenService.Create(this.endImage, ThumbstickFadeTweenInfo, { ImageTransparency: 1 });
			this.endImageFadeTween.Play();

			this.middleImageFadeTweens = this.middleImages.map((image, index) => TweenService.Create(image, ThumbstickFadeTweenInfo, { ImageTransparency: MIDDLE_TRANSPARENCIES[index] }));
			this.middleImageFadeTweens.forEach(tween => tween.Play());
		}
	}

	FadeThumbstickFrame(fadeDuration: number, fadeRatio: number) {
		this.fadeInAndOutHalfDuration = fadeDuration * 0.5;
		this.fadeInAndOutBalance = fadeRatio;
		this.tweenInAlphaStart = tick();
	}

	InputInFrame(inputObject: InputObject) {
		assert(this.thumbstickFrame);

		const frameCornerTopLeft: Vector2 = this.thumbstickFrame.AbsolutePosition;
		const frameCornerBottomRight = frameCornerTopLeft.add(this.thumbstickFrame.AbsoluteSize);
		const inputPosition = inputObject.Position;

		if (inputPosition.X >= frameCornerTopLeft.X && inputPosition.Y >= frameCornerTopLeft.Y) {
			if (inputPosition.X <= frameCornerBottomRight.X && inputPosition.Y <= frameCornerBottomRight.Y) {
				return true;
			}
		}

		return false;
	}

	DoFadeInBackground() {
		const playerGui = LocalPlayer.FindFirstChildOfClass("PlayerGui");
		let hasFadedBackgroundInOrientation = false;

		// only fade in/out the background once per orientation
		if (playerGui) {
			if (playerGui.CurrentScreenOrientation === Enum.ScreenOrientation.LandscapeLeft ||
				playerGui.CurrentScreenOrientation === Enum.ScreenOrientation.LandscapeRight) {
				hasFadedBackgroundInOrientation = this.hasFadedBackgroundInLandscape;
				this.hasFadedBackgroundInLandscape = true;
			} else if (playerGui.CurrentScreenOrientation === Enum.ScreenOrientation.Portrait) {
				hasFadedBackgroundInOrientation = this.hasFadedBackgroundInPortrait;
				this.hasFadedBackgroundInPortrait = true;
			}
		}

		if (!hasFadedBackgroundInOrientation) {
			this.fadeInAndOutHalfDuration = FADE_IN_OUT_HALF_DURATION_DEFAULT;
			this.fadeInAndOutBalance = FADE_IN_OUT_BALANCE_DEFAULT;
			this.tweenInAlphaStart = tick();
		}
	}

	DoMove(direction: Vector3) {
		let currentMoveVector: Vector3 = direction;

		// Scaled Radial Dead Zone
		const inputAxisMagnitude: number = currentMoveVector.Magnitude;

		if (inputAxisMagnitude < this.radiusOfDeadZone) {
			currentMoveVector = ZERO_VECTOR3;
		} else {
			currentMoveVector = currentMoveVector.Unit.mul(
				1 - math.max(0, (this.radiusOfMaxSpeed - currentMoveVector.Magnitude) / this.radiusOfMaxSpeed)
			);

			currentMoveVector = new Vector3(currentMoveVector.X, 0, currentMoveVector.Y);
		}

		this.moveVector = currentMoveVector;
	}


	LayoutMiddleImages(startPos: Vector2, endPos: Vector2) {
		const startDist = (this.thumbstickSize / 2) + this.middleSize;
		const vector = endPos.sub(startPos);
		const distAvailable = vector.Magnitude - (this.thumbstickRingSize / 2) - this.middleSize;
		const direction = vector.Unit;

		const distNeeded = this.middleSpacing * NUM_MIDDLE_IMAGES;

		let spacing = this.middleSpacing;

		if (distNeeded < distAvailable) {
			spacing = distAvailable / NUM_MIDDLE_IMAGES;
		}

		for (let i = 1; i <= NUM_MIDDLE_IMAGES; i++) {
			const image = this.middleImages[i];
			const distWithout = startDist + (spacing * (i - 2));
			const currentDist = startDist + (spacing * (i - 1));

			if (distWithout < distAvailable) {
				const pos = endPos.sub(direction.mul(currentDist));
				const exposedFraction = math.clamp(1 - ((currentDist - distAvailable) / spacing), 0, 1);

				image.Visible = true;
				image.Position = new UDim2(0, pos.X, 0, pos.Y);
				image.Size = new UDim2(0, this.middleSize * exposedFraction, 0, this.middleSize * exposedFraction);
			} else {
				image.Visible = false;
			}
		}
	}

	MoveStick(pos: Vector3) {
		assert(this.moveTouchStartPosition);
		assert(this.thumbstickFrame);
		assert(this.endImage);

		const vector2StartPosition = new Vector2(this.moveTouchStartPosition.X, this.moveTouchStartPosition.Y);
		const startPos = vector2StartPosition.sub(this.thumbstickFrame.AbsolutePosition);
		const endPos = new Vector2(pos.X, pos.Y).sub(this.thumbstickFrame.AbsolutePosition);

		this.endImage.Position = new UDim2(0, endPos.X, 0, endPos.Y);

		this.LayoutMiddleImages(startPos, endPos);
	}

	BindContextActions() {
		const inputBegan = (inputObject: InputObject) => {
			if (this.moveTouchObject) {
				return Enum.ContextActionResult.Pass;
			}

			if (!this.InputInFrame(inputObject)) {
				return Enum.ContextActionResult.Pass;
			}

			if (this.isFirstTouch) {
				this.isFirstTouch = false;

				assert(this.startImage);
				assert(this.endImage);

				const tweenInfo = new TweenInfo(0.5, Enum.EasingStyle.Quad, Enum.EasingDirection.Out, 0, false, 0);

				TweenService.Create(this.startImage, tweenInfo, { Size: new UDim2(0, 0, 0, 0) }).Play();
				TweenService.Create(
					this.endImage,
					tweenInfo,
					{ Size: new UDim2(0, this.thumbstickSize, 0, this.thumbstickSize), ImageColor3: new Color3(0, 0, 0) }
				).Play();
			}

			this.moveTouchLockedIn = false;
			this.moveTouchObject = inputObject;
			this.moveTouchStartPosition = inputObject.Position as unknown as Vector2;
			this.moveTouchFirstChanged = true;

			if (FADE_IN_OUT_BACKGROUND) {
				this.DoFadeInBackground();
			}

			return Enum.ContextActionResult.Pass;
		};

		const inputChanged = (inputObject: InputObject) => {
			if (inputObject === this.moveTouchObject) {
				if (this.moveTouchFirstChanged) {
					this.moveTouchFirstChanged = false;

					assert(this.thumbstickFrame);
					assert(this.startImage);
					assert(this.endImage);

					const startPosVec2 = new Vector2(
						inputObject.Position.X - this.thumbstickFrame.AbsolutePosition.X,
						inputObject.Position.Y - this.thumbstickFrame.AbsolutePosition.Y
					);

					this.startImage.Visible = true;
					this.startImage.Position = new UDim2(0, startPosVec2.X, 0, startPosVec2.Y);
					this.endImage.Visible = true;
					this.endImage.Position = this.startImage.Position;

					this.FadeThumbstick(true);
					this.MoveStick(inputObject.Position);
				}

				this.moveTouchLockedIn = true;

				assert(this.moveTouchStartPosition);

				const direction = new Vector2(
					inputObject.Position.X - this.moveTouchStartPosition.X,
					inputObject.Position.Y - this.moveTouchStartPosition.Y
				);

				if (math.abs(direction.X) > 0 || math.abs(direction.Y) > 0) {
					this.DoMove(direction as unknown as Vector3);
					this.MoveStick(inputObject.Position);
				}

				return Enum.ContextActionResult.Sink;
			}

			return Enum.ContextActionResult.Pass;
		};

		const inputEnded = (inputObject: InputObject) => {
			if (inputObject === this.moveTouchObject) {
				this.OnInputEnded();
				if (this.moveTouchLockedIn) {
					return Enum.ContextActionResult.Sink;
				}
			}
			return Enum.ContextActionResult.Pass;
		};

		const handleInput = (actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => {
			if (inputState === Enum.UserInputState.Begin) {
				return inputBegan(inputObject);
			} else if (inputState === Enum.UserInputState.Change) {
				if (FFlagUserDynamicThumbstickMoveOverButtons) {
					if (inputObject === this.moveTouchObject) {
						return Enum.ContextActionResult.Sink;
					} else {
						return Enum.ContextActionResult.Pass;
					}
				} else {
					return inputChanged(inputObject);
				}
			} else if (inputState === Enum.UserInputState.End) {
				return inputEnded(inputObject);
			} else if (inputState === Enum.UserInputState.Cancel) {
				this.OnInputEnded();
			}
		};

		ContextActionService.BindActionAtPriority(
			DYNAMIC_THUMBSTICK_ACTION_NAME,
			handleInput,
			false,
			DYNAMIC_THUMBSTICK_ACTION_PRIORITY,
			Enum.UserInputType.Touch);

		if (FFlagUserDynamicThumbstickMoveOverButtons) this.TouchMovedCon = UserInputService.TouchMoved.Connect((inputObject: InputObject, _gameProcessedEvent: boolean) => inputChanged(inputObject));
	}

	UnbindContextActions() {
		ContextActionService.UnbindAction(DYNAMIC_THUMBSTICK_ACTION_NAME);

		this.TouchMovedCon?.Disconnect();
	}

	Create(parentFrame: GuiBase2d) {
		if (this.thumbstickFrame) {
			this.thumbstickFrame.Destroy();
			this.thumbstickFrame = undefined;

			if (this.onRenderSteppedConn) {
				this.onRenderSteppedConn.Disconnect();
				this.onRenderSteppedConn = undefined;
			}

			if (this.absoluteSizeChangedConn) {
				this.absoluteSizeChangedConn.Disconnect();
				this.absoluteSizeChangedConn = undefined;
			}
		}

		const safeInset: number = FFlagUserDynamicThumbstickSafeAreaUpdate ? SAFE_AREA_INSET_MAX : 0;
		const layoutThumbstickFrame = (portraitMode: boolean) => {
			assert(this.thumbstickFrame);

			if (portraitMode) {
				this.thumbstickFrame.Size = new UDim2(1, safeInset, 0.4, safeInset);
				this.thumbstickFrame.Position = new UDim2(0, -safeInset, 0.6, 0);
			} else {
				this.thumbstickFrame.Size = new UDim2(0.4, safeInset, 2 / 3, safeInset);
				this.thumbstickFrame.Position = new UDim2(0, -safeInset, 1 / 3, 0);
			}
		};

		this.thumbstickFrame = new Instance("Frame");
		this.thumbstickFrame.BorderSizePixel = 0;
		this.thumbstickFrame.Name = "DynamicThumbstickFrame";
		this.thumbstickFrame.Visible = false;
		this.thumbstickFrame.BackgroundTransparency = 1.0;
		this.thumbstickFrame.BackgroundColor3 = Color3.fromRGB(0, 0, 0);
		this.thumbstickFrame.Active = false;

		layoutThumbstickFrame(false);

		this.startImage = new Instance("ImageLabel");
		this.startImage.Name = "ThumbstickStart";
		this.startImage.Visible = true;
		this.startImage.BackgroundTransparency = 1;
		this.startImage.Image = TOUCH_CONTROLS_SHEET;
		this.startImage.ImageRectOffset = new Vector2(1, 1);
		this.startImage.ImageRectSize = new Vector2(144, 144);
		this.startImage.ImageColor3 = new Color3(0, 0, 0);
		this.startImage.AnchorPoint = new Vector2(0.5, 0.5);
		this.startImage.ZIndex = 10;
		this.startImage.Parent = this.thumbstickFrame;

		this.endImage = new Instance("ImageLabel");
		this.endImage.Name = "ThumbstickEnd";
		this.endImage.Visible = true;
		this.endImage.BackgroundTransparency = 1;
		this.endImage.Image = TOUCH_CONTROLS_SHEET;
		this.endImage.ImageRectOffset = new Vector2(1, 1);
		this.endImage.ImageRectSize = new Vector2(144, 144);
		this.endImage.AnchorPoint = new Vector2(0.5, 0.5);
		this.endImage.ZIndex = 10;
		this.endImage.Parent = this.thumbstickFrame;

		for (let i = 1; i <= NUM_MIDDLE_IMAGES; i++) {
			this.middleImages[i] = new Instance("ImageLabel");
			this.middleImages[i].Name = "ThumbstickMiddle";
			this.middleImages[i].Visible = false;
			this.middleImages[i].BackgroundTransparency = 1;
			this.middleImages[i].Image = TOUCH_CONTROLS_SHEET;
			this.middleImages[i].ImageRectOffset = new Vector2(1, 1);
			this.middleImages[i].ImageRectSize = new Vector2(144, 144);
			this.middleImages[i].ImageTransparency = MIDDLE_TRANSPARENCIES[i];
			this.middleImages[i].AnchorPoint = new Vector2(0.5, 0.5);
			this.middleImages[i].ZIndex = 9;
			this.middleImages[i].Parent = this.thumbstickFrame;
		}

		const ResizeThumbstick = () => {
			const screenSize = parentFrame.AbsoluteSize;
			const isBigScreen = math.min(screenSize.X, screenSize.Y) > 500;

			const DEFAULT_THUMBSTICK_SIZE = 45;
			const DEFAULT_RING_SIZE = 20;
			const DEFAULT_MIDDLE_SIZE = 10;
			const DEFAULT_MIDDLE_SPACING = DEFAULT_MIDDLE_SIZE + 4;
			const RADIUS_OF_DEAD_ZONE = 2;
			const RADIUS_OF_MAX_SPEED = 20;

			if (isBigScreen) {
				this.thumbstickSize = DEFAULT_THUMBSTICK_SIZE * 2;
				this.thumbstickRingSize = DEFAULT_RING_SIZE * 2;
				this.middleSize = DEFAULT_MIDDLE_SIZE * 2;
				this.middleSpacing = DEFAULT_MIDDLE_SPACING * 2;
				this.radiusOfDeadZone = RADIUS_OF_DEAD_ZONE * 2;
				this.radiusOfMaxSpeed = RADIUS_OF_MAX_SPEED * 2;
			} else {
				this.thumbstickSize = DEFAULT_THUMBSTICK_SIZE;
				this.thumbstickRingSize = DEFAULT_RING_SIZE;
				this.middleSize = DEFAULT_MIDDLE_SIZE;
				this.middleSpacing = DEFAULT_MIDDLE_SPACING;
				this.radiusOfDeadZone = RADIUS_OF_DEAD_ZONE;
				this.radiusOfMaxSpeed = RADIUS_OF_MAX_SPEED;
			}

			assert(this.startImage);
			assert(this.endImage);

			this.startImage.Position = new UDim2(0, this.thumbstickRingSize * 3.3 + safeInset, 1, -this.thumbstickRingSize * 2.8 - safeInset);
			this.startImage.Size = new UDim2(0, this.thumbstickRingSize * 3.7, 0, this.thumbstickRingSize * 3.7);

			this.endImage.Position = this.startImage.Position;
			this.endImage.Size = new UDim2(0, this.thumbstickSize * 0.8, 0, this.thumbstickSize * 0.8);
		};

		ResizeThumbstick();

		this.absoluteSizeChangedConn = parentFrame.GetPropertyChangedSignal("AbsoluteSize").Connect(ResizeThumbstick);

		let CameraChangedConn: RBXScriptConnection | undefined;

		const onCurrentCameraChanged = () => {
			if (CameraChangedConn) {
				CameraChangedConn.Disconnect();
				CameraChangedConn = undefined;
			}

			const newCamera = Workspace.CurrentCamera;

			if (newCamera) {
				const onViewportSizeChanged = () => {
					const size = newCamera.ViewportSize;
					const portraitMode = size.X < size.Y;
					layoutThumbstickFrame(portraitMode);
				};
				CameraChangedConn = newCamera.GetPropertyChangedSignal("ViewportSize").Connect(onViewportSizeChanged);
				onViewportSizeChanged();
			}
		};

		Workspace.GetPropertyChangedSignal("CurrentCamera").Connect(onCurrentCameraChanged);

		if (Workspace.CurrentCamera) onCurrentCameraChanged();

		this.moveTouchStartPosition = undefined;

		this.startImageFadeTween = undefined;
		this.endImageFadeTween = undefined;
		this.middleImageFadeTweens.clear();

		this.onRenderSteppedConn = RunService.RenderStepped.Connect(() => {
			assert(this.thumbstickFrame);

			if (this.tweenInAlphaStart !== undefined) {
				const delta = tick() - this.tweenInAlphaStart;
				const fadeInTime = (this.fadeInAndOutHalfDuration * 2 * this.fadeInAndOutBalance);

				this.thumbstickFrame.BackgroundTransparency = 1 - FADE_IN_OUT_MAX_ALPHA * math.min(delta / fadeInTime, 1);

				if (delta > fadeInTime) {
					this.tweenOutAlphaStart = tick();
					this.tweenInAlphaStart = undefined;
				}
			} else if (this.tweenOutAlphaStart !== undefined) {
				const delta = tick() - this.tweenOutAlphaStart;
				const fadeOutTime = (this.fadeInAndOutHalfDuration * 2) - (this.fadeInAndOutHalfDuration * 2 * this.fadeInAndOutBalance);

				this.thumbstickFrame.BackgroundTransparency = 1 - FADE_IN_OUT_MAX_ALPHA + FADE_IN_OUT_MAX_ALPHA * math.min(delta / fadeOutTime, 1);

				if (delta > fadeOutTime) {
					this.tweenOutAlphaStart = undefined;
				}
			}
		});

		this.onTouchEndedConn = UserInputService.TouchEnded.Connect((inputObject: InputObject) => {
			if (inputObject === this.moveTouchObject) {
				this.OnInputEnded();
			}
		});

		GuiService.MenuOpened.Connect(() => {
			if (this.moveTouchObject) {
				this.OnInputEnded();
			}
		});

		let playerGui = LocalPlayer.FindFirstChildOfClass("PlayerGui");

		while (!playerGui) {
			LocalPlayer.ChildAdded.Wait();
			playerGui = LocalPlayer.FindFirstChildOfClass("PlayerGui");
		}

		const originalScreenOrientationWasLandscape = playerGui.CurrentScreenOrientation === Enum.ScreenOrientation.LandscapeLeft ||
			playerGui.CurrentScreenOrientation === Enum.ScreenOrientation.LandscapeRight;

		const longShowBackground = () => {
			this.fadeInAndOutHalfDuration = 2.5;
			this.fadeInAndOutBalance = 0.05;
			this.tweenInAlphaStart = tick();
		};

		const playerGuiChangedConn = playerGui.GetPropertyChangedSignal("CurrentScreenOrientation").Connect(() => {
			if ((originalScreenOrientationWasLandscape && playerGui.CurrentScreenOrientation === Enum.ScreenOrientation.Portrait) ||
				(!originalScreenOrientationWasLandscape && playerGui.CurrentScreenOrientation !== Enum.ScreenOrientation.Portrait)) {

				playerGuiChangedConn.Disconnect();
				longShowBackground();

				if (originalScreenOrientationWasLandscape) {
					this.hasFadedBackgroundInPortrait = true;
				} else {
					this.hasFadedBackgroundInLandscape = true;
				}
			}
		});

		this.thumbstickFrame.Parent = parentFrame;

		if (game.IsLoaded()) {
			longShowBackground();
		} else {
			coroutine.wrap(() => {
				game.Loaded.Wait();
				longShowBackground();
			})();
		}
	}
}