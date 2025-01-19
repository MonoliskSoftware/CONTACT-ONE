import Object from "@rbxts/object-utils";
import { RunService } from "@rbxts/services";
import { BaseController } from "../controllers/BaseController";
import { Signal } from "../Libraries/Signal";
import { ClientSideOnly } from "../Libraries/Utilities";
import { GameObject } from "../Scripts/Componentization/GameObject";
import { ExtractNetworkVariables, NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { Networking } from "../Scripts/Networking/Networking";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { FallbackStackBehavior } from "../stacks/local/FallbackStackBehavior";
import { StackBehavior } from "../stacks/local/StackBehavior";
import { CommandUnit } from "../stacks/organization/elements/CommandUnit";
import { Faction } from "../stacks/organization/elements/Faction";
import { GameStack, StackBehaviorConstructors } from "../stacks/StackManager";
import { GuiManager } from "./gui/GuiManager";
import { CameraModule } from "./local/cameras/CameraModule";
import { ControlModule } from "./local/controls/ControlModule";
import { PlayerModule } from "./local/PlayerModule";
import { PlayerState } from "./PlayerState";

/**
 * The PlayerBehavior is the manager used to manage and interface with an individual Player's scripts and behaviors.
 */
export class PlayerBehavior extends NetworkBehavior implements BaseController {
	public readonly player = new NetworkVariable<Player>(this, undefined as unknown as Player);
	public readonly state = new NetworkVariable<PlayerState>(this, PlayerState.LOBBY);
	public readonly faction = new NetworkVariable(this, undefined as unknown as Faction);

	// Stacks
	private currentStackBehavior: StackBehavior = this.getGameObject().addComponent(FallbackStackBehavior);
	private stackBehaviors = undefined as unknown as { [key in GameStack]: StackBehavior };

	public readonly stack = new NetworkVariable<GameStack>(this, GameStack.NONE);
	public readonly commandedUnitsChanged = new Signal<[]>(`${this.getId()}CommandChanged`);

	private readonly playerModule = RunService.IsClient() ? new PlayerModule() : undefined;
	private readonly guiManager = RunService.IsClient() && new GuiManager(this);

	public commandedUnits: CommandUnit[] = [];

	constructor(gameObject: GameObject) {
		super(gameObject);
	}

	@ClientSideOnly
	public getCameraModule(): CameraModule {
		return this.playerModule?.cameras as CameraModule;
	}

	@ClientSideOnly
	public getControlModule(): ControlModule {
		return this.playerModule?.controls as ControlModule;
	}

	@ClientSideOnly
	public getGuiManager(): GuiManager {
		return this.guiManager as GuiManager;
	}

	public onStart(): void {
		task.spawn(() => {
			this.stackBehaviors = this.initializeStackBehaviors();
			this.applyStack();
		});

		this.stack.onValueChanged.connect(() => this.applyStack());

		if (RunService.IsClient()) this.getGuiManager().initialize();
	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	private applyStack() {
		this.currentStackBehavior.deactivate();
		this.currentStackBehavior = this.stackBehaviors[this.stack.getValue()];
		this.currentStackBehavior.activate();
	}

	private initializeStackBehaviors() {
		if (RunService.IsServer()) {
			return Object.fromEntries(Object.entries(StackBehaviorConstructors).map(([key, value]) => [key, this.getGameObject().addComponent(value, {
				initialNetworkVariableStates: ({
					playerBehavior: this
				} satisfies ExtractNetworkVariables<StackBehavior> as unknown as Map<string, Networking.NetworkableTypes>)
			})]));
		} else {
			return Object.fromEntries(Object.entries(StackBehaviorConstructors).map(([key, value]) => [key, this.getGameObject().waitForComponent(value) as StackBehavior]));
		}
	}

	public commandUnitOnCommandTaken(unit: CommandUnit) {
		if (!this.commandedUnits.includes(unit)) this.commandedUnits.push(unit);

		this.commandedUnitsChanged.fire();
	}

	public commandUnitOnCommandRemoved(unit: CommandUnit) {
		this.commandedUnits.remove(this.commandedUnits.indexOf(unit));

		this.commandedUnitsChanged.fire();
	}

	public getCurrentStackBehavior(): StackBehavior {
		return this.currentStackBehavior;
	}
}