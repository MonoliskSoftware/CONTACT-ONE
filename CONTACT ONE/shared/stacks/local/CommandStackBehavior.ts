import { RunService, Workspace } from "@rbxts/services";
import { dict } from "CORP/shared/Libraries/Utilities";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { StackBehavior } from "./StackBehavior";

class CommandStackCameraModule {
	// Camera state data
	private focusPoint = Vector3.zero;
	private distance = 128;
	private lookDirection = (new Vector3(1, -1, 1)).Unit;
	private panning = false;

	// Camera settings data
	private focusPointBounds = new Region3(new Vector3(-1024, -512, -1024), new Vector3(1024, 512, 1024));
	private distanceRange = new NumberRange(16, 512);

	// Camera data
	private camera = Workspace.CurrentCamera;

	// State
	private activated = false;

	public activate() {
		RunService.BindToRenderStep("UpdateCommandStackCameraModule", Enum.RenderPriority.Camera.Value, deltaTime => this.onRenderStep(deltaTime));

		this.activated = true;
	}

	public deactivate() {
		RunService.UnbindFromRenderStep("UpdateCommandStackCameraModule");

		this.panning = false;
		this.activated = false;
	}

	private onRenderStep(deltaTime: number) {
		if (this.camera) {
			// this.camera.CameraType = Enum.CameraType.Orbital;
			this.camera.CameraSubject = ((Workspace as dict).SpawnLocation as BasePart);
			// this.camera.CFrame = CFrame.lookAt(this.focusPoint.sub(this.lookDirection.mul(this.distance)), this.focusPoint);
		}
	}

	private handleAction(actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) {
		print(actionName, inputState, inputObject);

		if (!this.activated) return Enum.ContextActionResult.Pass;

		switch (actionName) {
			case "ChangeCommandStackCameraDistance":
				print(inputObject.Delta, inputObject.Position);
				break;
			case "ToggleCommandStackCameraMovement":
				if (inputState === Enum.UserInputState.Begin || inputState === Enum.UserInputState.End || inputState === Enum.UserInputState.Cancel)
					this.panning = inputState === Enum.UserInputState.Begin;

				break;
			case "MoveCommandStackCamera":
				break;
		}
	}

	constructor() {
		warn("AYYY");
		if (RunService.IsClient()) {
			// ContextActionService.BindActionAtPriority("ChangeCommandStackCameraDistance", (actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => this.handleAction(actionName, inputState, inputObject), false, Enum.ContextActionPriority.High.Value, Enum.UserInputType.MouseWheel);
			// ContextActionService.BindActionAtPriority("MoveCommandStackCamera", (actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => this.handleAction(actionName, inputState, inputObject), false, Enum.ContextActionPriority.High.Value, Enum.UserInputType.MouseMovement);
			// ContextActionService.BindActionAtPriority("ToggleCommandStackCameraMovement", (actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => this.handleAction(actionName, inputState, inputObject), false, Enum.ContextActionPriority.High.Value, Enum.UserInputType.MouseButton2);
		}

	}
}

export class CommandStackBehavior extends StackBehavior {
	private cameraModule = new CommandStackCameraModule();
	private readonly lookPart = new NetworkVariable<Part>(this, undefined as unknown as Part);

	public onActivated(): void {
		print("Command stack activating!");

		if (RunService.IsServer()) {
			this.gamePlayer.getValue().player.getValue().ReplicationFocus = this.lookPart.getValue();
		} else {
			this.cameraModule.activate();
		}
	}

	public willDeactivate(): void {
		print("Command stack deactivating!");

		if (RunService.IsClient())
			this.cameraModule.deactivate();
	}

	public onStart(): void {
		print("AIIGHY");
		if (RunService.IsServer()) {
			const model = this.getGameObject().getInstance();

			model.AddPersistentPlayer(this.gamePlayer.getValue().player.getValue());
			model.ModelStreamingMode = Enum.ModelStreamingMode.PersistentPerPlayer;

			const part = new Instance("Part");

			part.Parent = model;
			part.Anchored = true;

			this.lookPart.setValue(part);
		}
	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}