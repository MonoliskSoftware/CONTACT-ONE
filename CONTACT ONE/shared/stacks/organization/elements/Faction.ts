import { Signal } from "CORP/shared/Libraries/Signal";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { BaseElement } from "./BaseElement";
import { CommandUnit } from "./CommandUnit";

/**
 * Factions are used to interface with and control groups/sides of the game.
 */
export class Faction extends BaseElement<CommandUnit> {
	public readonly subordinates: CommandUnit[] = [];
	public readonly name = new NetworkVariable<string>(this, "Faction name");
	public readonly eliminated = new Signal<[]>(`eliminated`);

	public static readonly factions = new Map<string, Faction>();

	public onStart(): void {
		Faction.factions.set(this.name.getValue(), this);
	}

	public willRemove(): void {
		Faction.factions.delete(this.name.getValue());
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	/**
	 * Used by {@link CommandUnit} internally when its associated faction changes.
	 */
	public subordinateOnAdded(commandUnit: CommandUnit) {
		if (!this.subordinates.includes(commandUnit)) this.subordinates.push(commandUnit);

		this.subordinateAdded.fire(commandUnit);
	}

	/**
	 * Used by {@link CommandUnit} internally when its associated faction changes.
	 */
	public subordinateOnRemoved(commandUnit: CommandUnit) {
		this.subordinateRemoving.fire(commandUnit);

		this.subordinates.remove(this.subordinates.indexOf(commandUnit));

		if (this.subordinates.size() === 0) this.eliminated.fire();
	}
}