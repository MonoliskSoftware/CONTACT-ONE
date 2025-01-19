import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { InventoryDescriptions } from "./InventoryDescriptions";

enum Test {

	asdasd,
	a3esdasd,
	asdaddesd
}

const preset = {
	equipmentPreset: {
		[Test.asdaddesd]: 3
	},
	integratedStorage: new Vector2
} satisfies InventoryDescriptions.InventoryPreset;


export class Inventory extends NetworkBehavior {
	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}