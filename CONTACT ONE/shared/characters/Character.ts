import { RunService } from "@rbxts/services";
import { Signal } from "../Libraries/Signal";
import { ServerSideOnly } from "../Libraries/Utilities";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { BaseElement } from "../stacks/organization/BaseElement";

const PathToRig = "CONTACT ONE/assets/prefabs/HumanoidRig";

/**
 * A rig is the physical component of a Character.
 */
export interface Rig extends Model {
	Humanoid: Humanoid,
	HumanoidRootPart: BasePart,
}

export class Character extends NetworkBehavior {
	/**
	 * Reference to the unit this character is assigned to, or undefined if none.
	 */
	public readonly unit = new NetworkVariable(this, undefined as unknown as BaseElement);
	/**
	 * Reference to the rig instance.
	 */
	private readonly rig = new NetworkVariable<Rig>(this, undefined as unknown as Rig);
	private lastUnit: BaseElement | undefined;

	public readonly onIsCommanderChanged = new Signal<[boolean]>(`${this.getId()}IsCommanderChanged`);

	public onStart(): void {
		if (RunService.IsServer()) this.initializeRig();
		
		this.applyUnit();

		this.unit.onValueChanged.connect(() => this.applyUnit());
	}

	public willRemove(): void {
		this.lastUnit = undefined;
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	private applyUnit() {
		const unit = this.unit.getValue();

		if (unit !== this.lastUnit) {


			this.lastUnit = unit;
		}
	}

	/**
	 * Returns whether or not this Character is the commander of its units
	 */
	public isCommander(): boolean {
		const unit = this.unit.getValue();

		return unit && unit.commander.getValue() === this;
	}

	@ServerSideOnly
	private initializeRig() {
		// Add prefab
		const rig = this.getGameObject().addInstancePrefabFromPath<Rig>(PathToRig);

		rig.ModelStreamingMode = Enum.ModelStreamingMode.Atomic;
		
		this.rig.setValue(rig);
	}
}