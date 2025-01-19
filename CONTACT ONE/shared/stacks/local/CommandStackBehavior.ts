import { Players, RunService, Workspace } from "@rbxts/services";
import { CameraModule } from "CONTACT ONE/shared/players/local/cameras/CameraModule";
import { CameraUtils } from "CONTACT ONE/shared/players/local/cameras/CameraUtils";
import { ControlModule } from "CONTACT ONE/shared/players/local/controls/ControlModule";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { RPC, RPCAccessPolicy, RPCAllowedEndpoints } from "CORP/shared/Scripts/Networking/RPC";
import { CommandStackComponent } from "./gui/CommandStackComponent";
import { StackBehavior } from "./StackBehavior";

const CommandStackViewerPath = "CONTACT ONE/assets/prefabs/CommandStackViewer";

interface CommandStackViewer extends Model {
	Root: Part,
	CameraNode: Part
}

function lerp(a: number, b: number, alpha: number) {
	return a + (b - a) * alpha;
}

class CommandStackCameraModule {
	// Camera state data
	private focusPoint = Vector3.zero;

	// Camera settings data
	private readonly bounds = new Region3(new Vector3(-1024, -512, -1024), new Vector3(1024, 512, 1024));
	private readonly distanceRange = new NumberRange(16, 512);
	private readonly speedRange = new NumberRange(16, 64);

	// Camera data
	private camera = Workspace.CurrentCamera;

	// State
	private activated = false;

	// Info
	private behavior: CommandStackBehavior;
	private controlModule: ControlModule;
	private cameraModule: CameraModule;

	public activate() {
		RunService.BindToRenderStep("UpdateCommandStackCameraModule", Enum.RenderPriority.Camera.Value, deltaTime => this.onRenderStep(deltaTime));

		this.activated = true;

		if (this.camera) {
			this.camera.CameraType = Enum.CameraType.Custom;
		}
	}

	public deactivate() {
		RunService.UnbindFromRenderStep("UpdateCommandStackCameraModule");

		this.activated = false;
	}

	private getMoveVector() {
		assert(this.camera);

		const absolute = this.camera.CFrame.ToWorldSpace(CFrame.lookAt(Vector3.zero, this.controlModule.GetMoveVector())).LookVector.mul(new Vector3(1, 0, 1));

		return !CameraUtils.IsFiniteVector3(absolute) ? Vector3.zero : absolute;
	}

	private getCurrentCameraDistance() {
		return this.cameraModule.activeCameraController?.GetCameraToSubjectDistance() ?? 16;
	}

	private getDistanceFraction() {
		const dist = this.getCurrentCameraDistance();

		return (dist - this.distanceRange.Min) / (this.distanceRange.Max - this.distanceRange.Min);
	}

	private getCurrentSpeed() {
		return lerp(this.speedRange.Min, this.speedRange.Max, this.getDistanceFraction());
	}

	private applyCameraDistance() {
		Players.LocalPlayer.CameraMinZoomDistance = this.distanceRange.Min;
		Players.LocalPlayer.CameraMaxZoomDistance = this.distanceRange.Max;
	}

	private onRenderStep(deltaTime: number) {
		if (this.camera) {
			const viewer = this.behavior.viewer.getValue();

			this.camera.CameraSubject = viewer.CameraNode;

			viewer.CameraNode.Position = viewer.CameraNode.Position.Lerp(viewer.Root.Position, deltaTime * 10);

			this.applyCameraDistance();

			this.behavior.updateViewerPosition(viewer.Root.Position.add(this.getMoveVector().mul(this.getCurrentSpeed())));
		}
	}

	constructor(behavior: CommandStackBehavior) {
		this.behavior = behavior;
		this.controlModule = behavior.playerBehavior.getValue().getControlModule();
		this.cameraModule = behavior.playerBehavior.getValue().getCameraModule();
	}
}

export class CommandStackBehavior extends StackBehavior {
	private cameraModule: CommandStackCameraModule = undefined as unknown as CommandStackCameraModule;
	public readonly viewer = new NetworkVariable(this, undefined as unknown as CommandStackViewer);

	public readonly guiComponent = CommandStackComponent;

	@RPC.Method({
		allowedEndpoints: RPCAllowedEndpoints.CLIENT_TO_SERVER,
		accessPolicy: RPCAccessPolicy.OWNER
	})
	updateViewerPosition(position: Vector3) {
		const model = this.viewer.getValue();
		const result = Workspace.Raycast(new Vector3(position.X, 1024, position.Y), new Vector3(0, -1024, 0));
		const final = new Vector3(position.X, result ? result.Position.Y : 8, position.Z);

		model.Root.Position = final;
	}

	public onActivated(): void {
		print("Command stack activating!");

		if (RunService.IsServer()) {
			this.playerBehavior.getValue().player.getValue().ReplicationFocus = this.viewer.getValue().PrimaryPart;
		} else {
			this.cameraModule.activate();
		}
	}

	public willDeactivate(): void {
		if (RunService.IsClient())
			this.cameraModule.deactivate();
	}

	public onStart(): void {
		if (RunService.IsServer()) {
			const model = this.getGameObject().getInstance();

			model.AddPersistentPlayer(this.playerBehavior.getValue().player.getValue());
			model.ModelStreamingMode = Enum.ModelStreamingMode.PersistentPerPlayer;

			this.viewer.setValue(this.getGameObject().addInstancePrefabFromPath(CommandStackViewerPath));
		} else {
			this.cameraModule = new CommandStackCameraModule(this);
		}
	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}