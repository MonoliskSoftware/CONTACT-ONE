import { GameStack } from "../../StackManager";
import { CommandUnit } from "./CommandUnit";
import { Faction } from "./Faction";
import { Unit } from "./Unit";

/**
 * Battle units compose the elements of Command units and other Battle units. The subordinates of 
 */
export class BattleUnit extends Unit<BattleUnit | CommandUnit, BattleUnit> {
	private lastParent: CommandUnit | BattleUnit | undefined;

	public readonly stack = GameStack.BATTLE_STACK;
	public readonly subordinates: BattleUnit[] = [];

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

	public getCommandUnit(): CommandUnit | undefined {
		let parent = this.parent.getValue();

		while (parent) {
			if (parent instanceof CommandUnit) return parent;

			parent = parent.parent?.getValue();
		}

		return undefined;
	}

	public getFaction(): Faction | undefined {
		return this.getCommandUnit()?.getFaction();
	}
}