import { GameObject } from "../Scripts/Componentization/GameObject";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";

export interface WinState {
	wasStalemate: boolean,
	winningFaction: string	
}

export enum GameState {
	INTERMISSION,
	// CUSTOMIZATION,
	PREPARATION,
	ACTION,
	DEBRIEFING
}

export class GameStateManager extends NetworkBehavior {
	private static singleton: GameStateManager;

	public readonly state = new NetworkVariable<GameState>(this, GameState.INTERMISSION);
	public readonly lastWin = new NetworkVariable<WinState>(this, undefined as unknown as WinState);

	constructor(gameObject: GameObject) {
		super(gameObject);

		GameStateManager.singleton = this;
	}

	public onStart(): void {
		this.lastWin.onValueChanged.connect(win => {
			if (this.state.getValue() !== GameState.DEBRIEFING) this.state.applyValue(GameState.DEBRIEFING);
		});
	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public static getSingleton() {
		return this.singleton;
	}

	public onWin(winState: WinState) {
		this.lastWin.setValue(winState);
	}
}