import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { CommandUnit } from "./CommandUnit";

/**
 * Factions are used to interface with and control groups/sides of the game.
 */
export class Faction extends NetworkBehavior {
	public readonly commandUnits: CommandUnit[] = [];
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
		if (!this.commandUnits.includes(commandUnit)) this.commandUnits.push(commandUnit);
	}

	/**
	 * Used by {@link CommandUnit} internally when its associated faction changes.
	 */
	public subordinateOnRemoved(commandUnit: CommandUnit) {
		this.commandUnits.remove(this.commandUnits.indexOf(commandUnit));
	}
}