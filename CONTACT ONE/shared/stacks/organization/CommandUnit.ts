import { BaseController } from "CONTACT ONE/shared/controllers/BaseController";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { GameStack } from "../StackManager";
import { BaseElement } from "./BaseElement";
import { BattleUnit } from "./BattleUnit";
import { Faction } from "./Faction";

/**
 * Command units are the highest level in the org hierarchy. The subordinates of a Command unit are always Battle units.
 */
export class CommandUnit extends BaseElement {
	public readonly subordinates: (BattleUnit | CommandUnit)[] = [];
	public readonly controller = new NetworkVariable<BaseController>(this, undefined as unknown as BaseController);
	public readonly parent = new NetworkVariable<Faction | CommandUnit>(this, undefined as unknown as Faction);

	private lastParent: Faction | CommandUnit | undefined;
	private lastController: BaseController | undefined;

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
	}

	public subordinateOnRemoved(subordinate: CommandUnit | BattleUnit) {
		this.subordinates.remove(this.subordinates.indexOf(subordinate));
	}

	getStack(): GameStack {
		return GameStack.COMMAND_STACK;
	}
}