/* eslint-disable @typescript-eslint/no-explicit-any */
import Object from "@rbxts/object-utils";
import { RunService, Workspace } from "@rbxts/services";
import { BattleController } from "../controllers/BattleController";
import { CommandController } from "../controllers/CommandController";
import { GameState, GameStateManager } from "../flow/GameStateManager";
import { Connection, Signal } from "../Libraries/Signal";
import { ClientSideOnly } from "../Libraries/Utilities";
import { GameObject } from "../Scripts/Componentization/GameObject";
import { ExtractNetworkVariables, NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { Networking } from "../Scripts/Networking/Networking";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { FallbackStackBehavior } from "../stacks/local/FallbackStackBehavior";
import { StackBehavior } from "../stacks/local/StackBehavior";
import { CommandUnit } from "../stacks/organization/elements/CommandUnit";
import { Faction } from "../stacks/organization/elements/Faction";
import { BaseOrder } from "../stacks/organization/orders/BaseOrder";
import { GameStack, StackBehaviorConstructors } from "../stacks/StackManager";
import { GuiManager } from "./gui/GuiManager";
import { CameraModule } from "./local/cameras/CameraModule";
import { ControlModule } from "./local/controls/ControlModule";
import { PlayerModule } from "./local/PlayerModule";
import { PlayerState } from "./PlayerState";

function getHorizontalLook(position: CFrame) {
	return CFrame.lookAt(position.Position, new Vector3(position.LookVector.X, 0, position.LookVector.Z));
}

export class PlayerController extends BattleController {
	public readonly behavior = new NetworkVariable<PlayerBehavior>(this, undefined!);

	public onOrderReceived(order: BaseOrder<any>): void {

	}

	protected onControllerEnabled(): void {
		if (RunService.IsServer()) {
			this.getPlayer().Character = this.character.rig.getValue();

			this.character.died.connect(() => {
				const playerBehavior = this.getPlayerBehavior();
				
				playerBehavior.state.setValue(PlayerState.ELIMINATED);
				playerBehavior.getCurrentStackBehavior().onEliminated();
			});
		} else {
			this.getPlayerBehavior().getControlModule().SetMoveFunction((dir, cameraRelative) => {
				const final = cameraRelative ? getHorizontalLook(Workspace.CurrentCamera!.CFrame).mul(new CFrame(dir)).LookVector : dir;

				this.character.getHumanoid().Move(final);
			});
		}
	}

	protected onControllerDisabled(): void {
		if (RunService.IsClient()) this.getPlayerBehavior().getControlModule().SetMoveFunction(undefined);
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getPlayerBehavior() {
		return this.behavior.getValue();
	}

	protected getPlayer() {
		return this.getPlayerBehavior().player.getValue();
	}
}

/**
 * The PlayerBehavior is the manager used to manage and interface with an individual Player's scripts and behaviors.
 */
export class PlayerBehavior extends NetworkBehavior implements CommandController {
	public readonly player = new NetworkVariable<Player>(this, undefined!);
	public readonly state = new NetworkVariable<PlayerState>(this, PlayerState.LOBBY);
	public readonly faction = new NetworkVariable<Faction>(this, undefined!);

	private lastState: PlayerState = this.state.getValue();

	// Stacks
	private currentStackBehavior: StackBehavior = this.getGameObject().addComponent(FallbackStackBehavior);
	private stackBehaviors!: { [key in GameStack]: StackBehavior };

	public readonly stack = new NetworkVariable<GameStack>(this, GameStack.NONE);
	public readonly commandedUnitsChanged = new Signal<[]>(`${this.getId()}CommandChanged`);

	private readonly playerModule = RunService.IsClient() ? new PlayerModule() : undefined;
	private readonly guiManager = RunService.IsClient() && new GuiManager(this);

	public commandedUnits: CommandUnit[] = [];

	private gameStateConnection: Connection<[GameState]> | undefined;

	private readonly characterController = new NetworkVariable<PlayerController>(this, undefined!);

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
		this.state.onValueChanged.connect(newState => {
			this.applyStack();

			this.lastState = newState;
		});

		if (RunService.IsServer()) {
			this.characterController.setValue(this.getGameObject().addComponent(PlayerController, {
				initialNetworkVariableStates: ({
					behavior: this
				} satisfies ExtractNetworkVariables<PlayerController> as unknown as Map<string, Networking.NetworkableTypes>)
			}));
		}

		this.gameStateConnection = GameStateManager.getSingleton().state.onValueChanged.connect(state => this.state.applyValue(PlayerState.DEBRIEFING));

		if (RunService.IsClient()) this.getGuiManager().initialize();
	}

	public willRemove(): void {
		this.gameStateConnection?.disconnect();
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	private applyStack() {
		const newBehavior = this.stackBehaviors[this.stack.getValue()];
		const behaviorDidChange = newBehavior !== this.currentStackBehavior;

		if (behaviorDidChange || this.lastState === PlayerState.IN_GAME) this.currentStackBehavior.deactivate();
		if (behaviorDidChange) this.currentStackBehavior = newBehavior;
		if (this.state.getValue() === PlayerState.IN_GAME)
			this.currentStackBehavior.activate();
	}

	private initializeStackBehaviors() {
		if (RunService.IsServer()) {
			return Object.fromEntries(Object.entries(StackBehaviorConstructors).map(([key, value]) => [key, this.getGameObject().addComponent(value, {
				initialNetworkVariableStates: ({
					playerBehavior: this,
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

	//#region Getters
	public getCurrentStackBehavior(): StackBehavior {
		return this.currentStackBehavior;
	}

	public getBattleController(): PlayerController {
		return this.characterController.getValue();
	}
}