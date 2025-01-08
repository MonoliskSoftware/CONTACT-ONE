//!nonstrict
//[[
	// FileName: TouchJump
	// Version 1.0
	// Written by: jmargh
	// Description: Implements jump controls for touch devices. Use with Thumbstick and Thumbpad
//]]

const Players = game:GetService("Players")
const GuiService = game:GetService("GuiService")

const CommonUtils = script.Parent.Parent:WaitForChild("CommonUtils")
const FlagUtil = require(CommonUtils:WaitForChild("FlagUtil"))

const FFlagUserUpdateTouchJump = FlagUtil.getUserFlag("UserUpdateTouchJump2")
const ConnectionUtil
const CharacterUtil
if ( FFlagUserUpdateTouchJump ){
	ConnectionUtil = require(CommonUtils:WaitForChild("ConnectionUtil"))
	CharacterUtil = require(CommonUtils:WaitForChild("CharacterUtil"))
}

const TOUCH_CONTROL_SHEET = "rbxasset://textures/ui/Input/TouchControlsSheetV2.png"
const CONNECTIONS = {
	HUMANOID_STATE_ENABLED_CHANGED = "HUMANOID_STATE_ENABLED_CHANGED",
	HUMANOID_JUMP_POWER = "HUMANOID_JUMP_POWER",
	HUMANOID = "HUMANOID",
	JUMP_INPUT_ENDED = "JUMP_INPUT_ENDED",
	MENU_OPENED = "MENU_OPENED",
}

type TouchJumpClass = {
	new: () -> TouchJump,

	// resets the state of the class, does ! affect enable/disable status.
	// Does ! disconnect or create new connections.
	_reset: (this: TouchJump) -> (),
	// checks the relevant APIs that may change the state of the module and adds connects
	// to checks for changes
	_setupConfigurations: (this: TouchJump) -> (),
}

export type TouchJump = typeof(setmetatable({} :: {
	// holds any connections this module makes
	_connectionUtil: any, // ConnectionUtil.ConnectionUtil,
	// true if ( the jump is active including checks like humanoid state and if ( the module is active
	_active: boolean
}, {} :: TouchJumpClass))


//[[ The Module ]]//
const BaseCharacterController = require(script.Parent:WaitForChild("BaseCharacterController"))
const TouchJump = setmetatable({}, BaseCharacterController)
TouchJump.__index = TouchJump

function TouchJump.new()
	const this = setmetatable(BaseCharacterController.new() :: any, TouchJump)

	this.parentUIFrame = undefined
	this.jumpButton = undefined

	if ( ! FFlagUserUpdateTouchJump ){
		this.characterAddedConn = undefined // remove with FFlagUserUpdateTouchJump
		this.humanoidStateEnabledChangedConn = undefined // remove with FFlagUserUpdateTouchJump
		this.humanoidJumpPowerConn = undefined // remove with FFlagUserUpdateTouchJump
		this.humanoidParentConn = undefined // remove with FFlagUserUpdateTouchJump
		this.jumpPower = 0 // remove with FFlagUserUpdateTouchJump
		this.jumpStateEnabled = true // remove with FFlagUserUpdateTouchJump
		this.humanoid = undefined // saved reference because property change connections are made using it - remove with FFlagUserUpdateTouchJump
	}

	this.externallyEnabled = false
	this.isJumping = false
	if ( FFlagUserUpdateTouchJump ){
		this._active = false
		this._connectionUtil = ConnectionUtil.new()
	}

	return this
}

if ( FFlagUserUpdateTouchJump ){
function TouchJump:_reset()
	this.isJumping = false
	this.touchObject = undefined
	if ( this.jumpButton ){
		this.jumpButton.ImageRectOffset = Vector2.new(1, 146)
	}
}
}

function TouchJump:EnableButton(enable)
	if ( FFlagUserUpdateTouchJump ){
		if ( enable == this._active ){
			return
		}

		if ( enable ){
			if ( ! this.jumpButton ){
				this:Create()
			}
			this.jumpButton.Visible = true

			// input connections
			// stop jumping connection
			this._connectionUtil:trackConnection(
				CONNECTIONS.JUMP_INPUT_ENDED,
				this.jumpButton.InputEnded:Connect(function(inputObject)
					if ( inputObject == this.touchObject ){
						this:_reset()
					}
				})
			)

			// stop jumping on menu open
			this._connectionUtil:trackConnection(
				CONNECTIONS.MENU_OPENED,
				GuiService.MenuOpened:Connect(function()
					if ( this.touchObject ){
						this:_reset()
					}
				})
			)
		} else {
			if ( this.jumpButton ){
				this.jumpButton.Visible = false
			}
			this._connectionUtil:disconnect(CONNECTIONS.JUMP_INPUT_ENDED)
			this._connectionUtil:disconnect(CONNECTIONS.MENU_OPENED)
		}
		this:_reset()
		this._active = enable
	} else {
		if ( enable ){
			if ( ! this.jumpButton ){
				this:Create()
			}
			const humanoid = Players.LocalPlayer.Character && Players.LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
			if ( humanoid && this.externallyEnabled ){
				if ( this.externallyEnabled ){
					if ( humanoid.JumpPower > 0 ){
						this.jumpButton.Visible = true
					}
				}
			}
		} else {
			this.jumpButton.Visible = false
			this.touchObject = undefined
			this.isJumping = false
			this.jumpButton.ImageRectOffset = Vector2.new(1, 146)
		}
	}
}

function TouchJump:UpdateEnabled()
	if ( FFlagUserUpdateTouchJump ){
		const humanoid = CharacterUtil.getChild("Humanoid", "Humanoid") 
		if ( humanoid && this.externallyEnabled && humanoid.JumpPower > 0 && humanoid:GetStateEnabled(Enum.HumanoidStateType.Jumping) ){
			this:EnableButton(true)
		} else {
			this:EnableButton(false)
		}
	} else {
		if ( this.jumpPower > 0 && this.jumpStateEnabled ){
			this:EnableButton(true)
		} else {
			this:EnableButton(false)
		}
	}
}

if ( FFlagUserUpdateTouchJump ){
	function TouchJump:_setupConfigurations()
		const function update()
			this:UpdateEnabled()
		}

		// listen to jump APIs on the humanoid
		const humanoidConnection = CharacterUtil.onChild("Humanoid", "Humanoid", function(humanoid)
			update()
			this._connectionUtil:trackConnection(
				CONNECTIONS.HUMANOID_JUMP_POWER,
				humanoid:GetPropertyChangedSignal("JumpPower"):Connect(update)
			)
			this._connectionUtil:trackConnection(
				CONNECTIONS.HUMANOID_STATE_ENABLED_CHANGED,
				humanoid.StateEnabledChanged:Connect(update)
			)
		})
		this._connectionUtil:trackConnection(CONNECTIONS.HUMANOID, humanoidConnection)
	}
}

if ( ! FFlagUserUpdateTouchJump ){
	function TouchJump:HumanoidChanged(prop) // remove with FFlagUserUpdateTouchJump
		const humanoid = Players.LocalPlayer.Character
			&& Players.LocalPlayer.Character:FindFirstChildOfClass("Humanoid")
		if ( humanoid ){
			if ( prop == "JumpPower" ){
				this.jumpPower = humanoid.JumpPower
				this:UpdateEnabled()
			} else if ( prop == "Parent" ){
				if ( ! humanoid.Parent ){
					this.humanoidChangeConn:Disconnect()
				}
			}
		}
	}

	function TouchJump:HumanoidStateEnabledChanged(state, isEnabled) // remove with FFlagUserUpdateTouchJump
		if ( state == Enum.HumanoidStateType.Jumping ){
			this.jumpStateEnabled = isEnabled
			this:UpdateEnabled()
		}
	}

	function TouchJump:CharacterAdded(char) // remove with FFlagUserUpdateTouchJump
		if ( this.humanoidChangeConn ){
			this.humanoidChangeConn:Disconnect()
			this.humanoidChangeConn = undefined
		}

		this.humanoid = char:FindFirstChildOfClass("Humanoid")
		while ! this.humanoid {
			char.ChildAdded:wait()
			this.humanoid = char:FindFirstChildOfClass("Humanoid")
		}

		this.humanoidJumpPowerConn = this.humanoid:GetPropertyChangedSignal("JumpPower"):Connect(function()
			this.jumpPower = this.humanoid.JumpPower
			this:UpdateEnabled()
		})

		this.humanoidParentConn = this.humanoid:GetPropertyChangedSignal("Parent"):Connect(function()
			if ( ! this.humanoid.Parent ){
				this.humanoidJumpPowerConn:Disconnect()
				this.humanoidJumpPowerConn = undefined
				this.humanoidParentConn:Disconnect()
				this.humanoidParentConn = undefined
			}
		})

		this.humanoidStateEnabledChangedConn = this.humanoid.StateEnabledChanged:Connect(function(state, enabled)
			this:HumanoidStateEnabledChanged(state, enabled)
		})

		this.jumpPower = this.humanoid.JumpPower
		this.jumpStateEnabled = this.humanoid:GetStateEnabled(Enum.HumanoidStateType.Jumping)
		this:UpdateEnabled()
	}

	function TouchJump:SetupCharacterAddedFunction() // remove with FFlagUserUpdateTouchJump
		this.characterAddedConn = Players.LocalPlayer.CharacterAdded:Connect(function(char)
			this:CharacterAdded(char)
		})
		if ( Players.LocalPlayer.Character ){
			this:CharacterAdded(Players.LocalPlayer.Character)
		}
	}
}

function TouchJump:Enable(enable, parentFrame)
	if ( parentFrame ){
		this.parentUIFrame = parentFrame
	}
	this.externallyEnabled = enable
	if ( FFlagUserUpdateTouchJump ){
		this:UpdateEnabled()

		if ( enable ){
			this:_setupConfigurations()
		} else {
			this._connectionUtil:disconnectAll()
		}
	} else {
		this:EnableButton(enable)
	}
}

function TouchJump:Create()
	if ( ! this.parentUIFrame ){
		return
	}

	if ( this.jumpButton ){
		this.jumpButton:Destroy()
		this.jumpButton = undefined
	}

	if ( this.absoluteSizeChangedConn ){
		this.absoluteSizeChangedConn:Disconnect()
		this.absoluteSizeChangedConn = undefined
	}

	this.jumpButton = Instance.new("ImageButton")
	this.jumpButton.Name = "JumpButton"
	this.jumpButton.Visible = false
	this.jumpButton.BackgroundTransparency = 1
	this.jumpButton.Image = TOUCH_CONTROL_SHEET
	this.jumpButton.ImageRectOffset = Vector2.new(1, 146)
	this.jumpButton.ImageRectSize = Vector2.new(144, 144)
	
	const function ResizeJumpButton()
		const minAxis = math.min(this.parentUIFrame.AbsoluteSize.x, this.parentUIFrame.AbsoluteSize.y)
		const isSmallScreen = minAxis <= 500
		const jumpButtonSize = isSmallScreen ? 70 : 120

		this.jumpButton.Size = UDim2.new(0, jumpButtonSize, 0, jumpButtonSize)
		this.jumpButton.Position = isSmallScreen ? UDim2.new(1, -(jumpButtonSize*1.5-10), 1, -jumpButtonSize - 20) :
			UDim2.new(1, -(jumpButtonSize*1.5-10), 1, -jumpButtonSize * 1.75)
	}

	ResizeJumpButton()
	this.absoluteSizeChangedConn = this.parentUIFrame:GetPropertyChangedSignal("AbsoluteSize"):Connect(ResizeJumpButton)

	this.touchObject = undefined
	this.jumpButton.InputBegan:connect(function(inputObject)
		//A touch that starts elsewhere on the screen will be sent to a frame's InputBegan event
		//if ( it moves over the frame. So we check that this is actually a new touch (inputObject.UserInputState !== Enum.UserInputState.Begin)
		if ( this.touchObject || inputObject.UserInputType !== Enum.UserInputType.Touch
			|| inputObject.UserInputState !== Enum.UserInputState.Begin ){
			return
		}

		this.touchObject = inputObject
		this.jumpButton.ImageRectOffset = Vector2.new(146, 146)
		this.isJumping = true
	})

	if ( ! FFlagUserUpdateTouchJump ){
		const OnInputEnded = function()
			this.touchObject = undefined
			this.isJumping = false
			this.jumpButton.ImageRectOffset = Vector2.new(1, 146)
		}
	
		this.jumpButton.InputEnded:connect(function(inputObject: InputObject)
			if ( inputObject == this.touchObject ){
				OnInputEnded()
			}
		})
	
		GuiService.MenuOpened:connect(function()
			if ( this.touchObject ){
				OnInputEnded()
			}
		})

		if ( ! this.characterAddedConn ){
			this:SetupCharacterAddedFunction()
		}
	}

	this.jumpButton.Parent = this.parentUIFrame
}

return TouchJump
