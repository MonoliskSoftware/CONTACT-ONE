import { RunService } from "@rbxts/services";
import { GameStack } from "../../StackManager";
import { CommandUnit } from "./CommandUnit";
import { Faction } from "./Faction";
import { Unit } from "./Unit";

/**
 * Battle units compose the elements of Command units and other Battle units. The subordinates of 
 */
export class BattleUnit extends Unit<BattleUnit | CommandUnit, BattleUnit> {
	public readonly stack = GameStack.BATTLE_STACK;
	public readonly subordinates: BattleUnit[] = [];

	public onStart(): void {
		super.onStart();
	}

	public willRemove(): void {
		super.willRemove();
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public subordinateOnAdded(subordinate: BattleUnit) {
		if (!this.subordinates.includes(subordinate)) this.subordinates.push(subordinate);
	}

	public subordinateOnRemoved(subordinate: BattleUnit) {
		this.subordinates.remove(this.subordinates.indexOf(subordinate));

		if (RunService.IsServer()) super.checkIfShouldDestroy();
	}

	public getCommandUnit(): CommandUnit | undefined {
		let parent = this.parent.getValue();

		while (parent) {
			if (parent instanceof CommandUnit) return parent;

			parent = parent.parent?.getValue();
		}

		return undefined;
	}

	public getFaction(): Faction {
		return this.getCommandUnit()!.getFaction();
	}
}