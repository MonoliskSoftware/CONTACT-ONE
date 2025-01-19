import { RunService } from "@rbxts/services";
import { SpawnLocation } from "../entities/SpawnLocation";
import { Signal } from "../Libraries/Signal";
import { ServerSideOnly } from "../Libraries/Utilities";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { BattleUnit } from "../stacks/organization/elements/BattleUnit";
import { CommandUnit } from "../stacks/organization/elements/CommandUnit";
import { GenericUnit, Unit } from "../stacks/organization/elements/Unit";

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
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public readonly unit = new NetworkVariable(this, undefined as unknown as Unit<any, any>);
	/**
	 * Reference to the rig instance.
	 */
	public readonly rig = new NetworkVariable<Rig>(this, undefined as unknown as Rig);
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	private lastUnit: GenericUnit | undefined;

	public readonly onIsCommanderChanged = new Signal<[boolean]>(`${this.getId()}IsCommanderChanged`);

	public onStart(): void {
		if (RunService.IsServer()) this.initializeRig();
		
		this.applyUnit();

		this.unit.onValueChanged.connect(() => this.applyUnit());

		if (RunService.IsServer()) {
			this.rig.getValue().PivotTo(SpawnLocation.getSpawnLocationOfFaction((this.unit.getValue() as CommandUnit | BattleUnit).getFaction()?.name.getValue() ?? "")?.getGameObject().getInstance().GetPivot() ?? CFrame.identity);
		}
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
			const f = (unit as (CommandUnit | BattleUnit)).getFaction();

			if (RunService.IsServer()) {
				const c = f?.name.getValue() === "AGF" ? new Color3(1, 0, 0) : new Color3(0, 0, 1);

				this.rig.getValue().GetDescendants().forEach(i => {if (i.IsA("MeshPart")) {new Instance("SurfaceAppearance", i);i.Color = c;}});
	
			}
			
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

	public getHumanoid(): Humanoid {
		return this.rig.getValue().FindFirstChild("Humanoid") as Humanoid;
	}
}