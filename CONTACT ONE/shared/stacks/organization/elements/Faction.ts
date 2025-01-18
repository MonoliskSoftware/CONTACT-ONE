import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { BaseElement } from "./BaseElement";
import { CommandUnit } from "./CommandUnit";

/**
 * Factions are used to interface with and control groups/sides of the game.
 */
export class Faction extends BaseElement<CommandUnit> {
	public readonly subordinates: CommandUnit[] = [];
	public readonly name = new NetworkVariable<string>(this, "Faction name");

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	/**
	 * Used by {@link CommandUnit} internally when its associated faction changes.
	 */
	public subordinateOnAdded(commandUnit: CommandUnit) {
		if (!this.subordinates.includes(commandUnit)) this.subordinates.push(commandUnit);
	}

	/**
	 * Used by {@link CommandUnit} internally when its associated faction changes.
	 */
	public subordinateOnRemoved(commandUnit: CommandUnit) {
		this.subordinates.remove(this.subordinates.indexOf(commandUnit));
	}
}