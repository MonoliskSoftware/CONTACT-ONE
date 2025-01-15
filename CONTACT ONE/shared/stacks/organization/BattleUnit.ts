import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { GameStack } from "../StackManager";
import { BaseElement } from "./BaseElement";
import { CommandUnit } from "./CommandUnit";

/**
 * Battle units compose the elements of Command units and other Battle units. The subordinates of 
 */
export class BattleUnit extends BaseElement {
	// Subordinates are not NetworkVariables because they are dependent on parents.
	public readonly subordinates: BattleUnit[] = [];
	/**
	 * The parent of a Battle unit is used to define its hierarchy.
	 */
	public readonly parent = new NetworkVariable<CommandUnit | BattleUnit>(this, undefined as unknown as BattleUnit);

	private lastParent: CommandUnit | BattleUnit | undefined;

	public onStart(): void {
		this.applyAncestry();

		this.parent.onValueChanged.connect(parent => this.applyAncestry());
	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	private applyAncestry() {
		const newParent = this.parent.getValue();

		if (newParent !== this.lastParent) {
			this.lastParent?.subordinateOnRemoved(this);

			newParent?.subordinateOnAdded(this);

			this.lastParent = this.parent.getValue();
		}
	}

	public subordinateOnAdded(subordinate: BattleUnit) {
		if (!this.subordinates.includes(subordinate)) this.subordinates.push(subordinate); 
	}

	public subordinateOnRemoved(subordinate: BattleUnit) {
		this.subordinates.remove(this.subordinates.indexOf(subordinate));
	}

	getStack(): GameStack {
		return GameStack.BATTLE_STACK;
	}
}