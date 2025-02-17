/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { CommandController } from "CONTACT ONE/shared/controllers/CommandController";
import { NetworkVariableBinder } from "CONTACT ONE/shared/utilities/NetworkVariableBinder";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { GameStack } from "../../StackManager";
import { BattleUnit } from "./BattleUnit";
import { Faction } from "./Faction";
import { Unit } from "./Unit";

type CommandUnitParent = CommandUnit | Faction;

/**
 * Command units are the highest level in the org hierarchy. The subordinates of a Command unit are always Battle units.
 */
export class CommandUnit extends Unit<CommandUnitParent, CommandUnit | BattleUnit> {
	public readonly controller = new NetworkVariable<CommandController>(this, undefined!);

	public readonly subordinates: (CommandUnit | BattleUnit)[] = [];
	// public readonly associatedOrders: BaseOrder<any, any>[] = [];
	public readonly stack = GameStack.COMMAND_STACK;

	private readonly controllerBinder = new NetworkVariableBinder<CommandController, CommandUnit>(this, this.controller, "commandUnitOnCommandTaken", "commandUnitOnCommandRemoved");

	// public onOrderAdded(order: BaseOrder<any, any>) {
	// 	if (!this.associatedOrders.includes(order)) this.associatedOrders.push(order);
	// }

	// public onOrderRemoving(order: BaseOrder<any, any>) {
	// 	this.associatedOrders.remove(this.associatedOrders.indexOf(order));
	// }
	
	public onStart(): void {
		super.onStart();
		
		this.controllerBinder.start();
	}

	public willRemove(): void {
		super.willRemove();

		this.controllerBinder.teardown();
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public subordinateOnAdded(subordinate: CommandUnit | BattleUnit) {
		if (!this.subordinates.includes(subordinate)) this.subordinates.push(subordinate);

		this.subordinateAdded.fire(subordinate);
	}

	public subordinateOnRemoved(subordinate: CommandUnit | BattleUnit) {
		warn("removing a subordinate", getmetatable(subordinate));
		this.subordinateRemoving.fire(subordinate);

		this.subordinates.remove(this.subordinates.indexOf(subordinate));

		if (RunService.IsServer()) super.checkIfShouldDestroy();
	}

	public getFaction(): Faction {
		let parent = this.parent.getValue();

		while (parent) {
			if (parent instanceof Faction) return parent;

			parent = parent.parent?.getValue();
		}

		throw `No faction!`;
	}
}