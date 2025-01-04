import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
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

	private applyParent() {
		const newParent = this.parent.getValue();

		if (this.lastParent) 
			this.lastParent.subordinates.remove(this.lastParent.subordinates.indexOf(this));

		newParent.subordinates.push(this);

		this.lastParent = this.parent.getValue();
	}

	public onStart(): void {
		this.applyParent();

		this.parent.onValueChanged.connect(parent => this.applyParent());
	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}