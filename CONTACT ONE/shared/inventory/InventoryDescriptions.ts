import { SceneSerialization } from "../Scripts/Serialization/SceneSerialization";
import { NestedArray } from "../util/NestedArray";
import { Item } from "./Item";

export namespace InventoryDescriptions {
	export interface InventoryPreset<T extends PresetEquipmentDescription> {
		/**
		 * Storage built into the inventory.
		 */
		integratedStorage: number,
		
		equipmentPreset: T,
	}

	export type PresetEquipmentDescription = {
		[key: string | number]: typeof Item
	}

	export interface Loadout<T extends InventoryPreset<U>, U extends PresetEquipmentDescription> {
		integratedStorageContents: NestedArray<typeof Item>,
		equipment: {
			[key in keyof U]: SceneSerialization.ComponentDescription<Item>
		}
	}
}