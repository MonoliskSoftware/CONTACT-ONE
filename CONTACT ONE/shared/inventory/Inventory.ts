/* eslint-disable @typescript-eslint/no-explicit-any */
import { ServerSideOnly } from "../Libraries/Utilities";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { NetworkList } from "../Scripts/Networking/NetworkList";
import { InventoryDescriptions } from "./InventoryDescriptions";
import { Item } from "./Item";

export class Inventory<T extends InventoryDescriptions.InventoryPreset<any>> extends NetworkBehavior {
	public readonly preset: T = undefined!;
	public readonly integratedStorage = new NetworkList<Item>(this, []);

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	/**
	 * Inserts this item into the inventory.
	 */
	@ServerSideOnly
	public storeItem(item: Item) {
		this.integratedStorage.push(item);
	}

	public contains(item: Item) {
		return this.integratedStorage.includes(item);
	}
}