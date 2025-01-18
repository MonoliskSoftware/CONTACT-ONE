import { BaseController } from "CONTACT ONE/shared/controllers/BaseController";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { GameStack } from "../../StackManager";
import { BattleUnit } from "./BattleUnit";
import { Faction } from "./Faction";
import { Unit } from "./Unit";

/**
 * Command units are the highest level in the org hierarchy. The subordinates of a Command unit are always Battle units.
 */
export class CommandUnit extends Unit<Faction, CommandUnit | BattleUnit> {
	public readonly controller = new NetworkVariable<BaseController>(this, undefined as unknown as BaseController);

	private lastParent: CommandUnit | Faction | undefined;
	private lastController: BaseController | undefined;

	public readonly subordinates: (CommandUnit | BattleUnit)[] = [];
	public readonly stack = GameStack.COMMAND_STACK;

	public onStart(): void {
		this.applyAncestry();

		this.parent.onValueChanged.connect(() => this.applyAncestry());
		this.controller.onValueChanged.connect(() => this.applyController());

	}

	public willRemove(): void {
		this.lastParent = undefined;
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	/**
	 * Applies ancestry changes to NetworkVariables
	 */
	private applyAncestry() {
		const currentParent = this.parent.getValue();

		if (currentParent !== this.lastParent) {
			this.lastParent?.subordinateOnRemoved(this);

			currentParent?.subordinateOnAdded(this);

			this.lastParent = currentParent;
		}
	}

	/**
	 * Applies controller changes to NetworkVariables
	 */
	private applyController() {
		const currentController = this.controller.getValue();

		if (currentController !== this.lastController) {
			this.lastController?.commandUnitOnCommandRemoved(this);

			currentController?.commandUnitOnCommandTaken(this);

			this.lastController = currentController;
		}
	}

	public subordinateOnAdded(subordinate: CommandUnit | BattleUnit) {
		if (!this.subordinates.includes(subordinate)) this.subordinates.push(subordinate);

		this.subordinateAdded.fire(subordinate);
	}

	public subordinateOnRemoved(subordinate: CommandUnit | BattleUnit) {
		this.subordinateRemoving.fire(subordinate);

		this.subordinates.remove(this.subordinates.indexOf(subordinate));
	}
}