export namespace InventoryDescriptions {
	export interface InventoryPreset {
		/**
		 * Storage built into the inventory.
		 */
		integratedStorage: Vector2,
		
		equipmentPreset: PresetEquipmentDescription,
	}

	export type PresetEquipmentDescription = {
		[key: string | number]: number
	}
}