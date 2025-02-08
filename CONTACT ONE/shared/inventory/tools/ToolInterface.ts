/* eslint-disable @typescript-eslint/no-explicit-any */
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { Inventory } from "../Inventory";
import { InventoryDescriptions } from "../InventoryDescriptions";
import { ToolItem } from "./ToolItem";

/**
 * ToolInterfaces are used to provide an interface between entities (like a character or a vehicle) and tools.
 */
export class ToolInterface<T extends InventoryDescriptions.InventoryPreset<any>> extends NetworkBehavior {
	public readonly inventory = new NetworkVariable<Inventory<T>>(this, undefined!);

	private readonly currentTool = new NetworkVariable<ToolItem>(this, undefined!);

	public onStart(): void {
		
	}

	public willRemove(): void {
		
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	// Getters
	public getCurrentTool(): ToolItem | undefined {
		return this.currentTool.getValue();
	}

	public getInventory(): Inventory<T> {
		return this.inventory.getValue();
	}

	public activateTool(tool: ToolItem): Promise<void> {
		if (this.currentTool.getValue()) throw `A tool's already active!`;
		if (!this.inventory.getValue().contains(tool)) throw `This tool is not stored in the associated inventory.`;

		return tool.activate(this).then(() => this.currentTool.setValue(tool)) as Promise<void>;
	}

	public deactivateCurrentTool(): Promise<void> {
		if (!this.currentTool.getValue()) throw `No current tool!`;

		return this.currentTool.getValue().deactivate(this).then(() => this.currentTool.setValue(undefined!));
	}
}