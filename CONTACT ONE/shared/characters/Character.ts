/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { BattleController } from "../controllers/BattleController";
import { SpawnLocation } from "../entities/SpawnLocation";
import { Inventory } from "../inventory/Inventory";
import { InventoryDescriptions } from "../inventory/InventoryDescriptions";
import { ToolInterface } from "../inventory/tools/ToolInterface";
import { BlasterWeapon } from "../items/weapons/BlasterWeapon";
import Collector from "../Libraries/GarbageCollector";
import { Signal } from "../Libraries/Signal";
import { Constructable, ServerSideOnly, Utilities } from "../Libraries/Utilities";
import { ExtractNetworkVariables, NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { Networking } from "../Scripts/Networking/Networking";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { BattleUnit } from "../stacks/organization/elements/BattleUnit";
import { CommandUnit } from "../stacks/organization/elements/CommandUnit";
import { Faction } from "../stacks/organization/elements/Faction";
import { Unit } from "../stacks/organization/elements/Unit";
import { NetworkBehaviorVariableBinder } from "../utilities/NetworkVariableBinder";
import { CharacterManager } from "./CharacterManager";
import { CharacterPhysics } from "./CharacterPhysics";

const PathToRig = "CONTACT ONE/assets/prefabs/HumanoidRig";

/**
 * A rig is the physical component of a Character.
 */
export interface Rig extends Model {
	Humanoid: Humanoid,
	HumanoidRootPart: BasePart,
}

export enum CharacterInventoryEquipmentType {
	PRIMARY,
	SECONDARY
}

export const CharacterEquipmentDescription: InventoryDescriptions.PresetEquipmentDescription = {
	[CharacterInventoryEquipmentType.PRIMARY]: BlasterWeapon
};

export const CharacterInventory: InventoryDescriptions.InventoryPreset<typeof CharacterEquipmentDescription> = {
	integratedStorage: 4,
	equipmentPreset: CharacterEquipmentDescription
};

export class Character extends NetworkBehavior {
	public static defaultController: Constructable<BattleController>;

	/**
	 * Reference to the unit this character is assigned to, or undefined if none.
	 */
	public readonly unit = new NetworkVariable<Unit<any, any>>(this, undefined!);

	private readonly unitBinder = new NetworkBehaviorVariableBinder(this as Character, this.unit, "memberOnAdded", "memberOnRemoving");

	/**
	 * Reference to the rig instance.
	 */
	public readonly rig = new NetworkVariable<Rig>(this, undefined!);

	public readonly assignedTarget = new NetworkVariable<Character>(this, undefined!);

	// CONTROLLER MANAGEMENT
	private readonly controller = new NetworkVariable<BattleController>(this, undefined!);
	private lastController: BattleController | undefined;

	/**
	 * Reference to the fallback controller, in case none is active
	 */
	private fallbackController: BattleController | undefined;

	// SIGNALS
	public readonly onIsCommanderChanged = new Signal<[boolean]>(`${this.getId()}IsCommanderChanged`);
	public readonly died = new Signal<[]>(`characterOnDied`);

	// MISC
	private readonly collector = new Collector();

	// INVENTORY STUFF
	public readonly inventory = new NetworkVariable<Inventory<typeof CharacterInventory>>(this, this.getGameObject().addComponent<Inventory<typeof CharacterInventory>>(Inventory, { preset: CharacterInventory }));
	public readonly toolInterface = new NetworkVariable<ToolInterface<typeof CharacterInventory>>(this, this.getGameObject().addComponent<ToolInterface<typeof CharacterInventory>>(ToolInterface, {
		initialNetworkVariableStates: ({
			inventory: this.inventory.getValue()
		} satisfies ExtractNetworkVariables<ToolInterface<typeof CharacterInventory>> as unknown as Map<string, Networking.NetworkableTypes>)
	}));

	//#region Initialization
	@ServerSideOnly
	private initializeCollider() {
		const collider = new Instance("Part");

		collider.Parent = this.rig.getValue();
		collider.Size = CharacterPhysics.CHARACTER_COLLIDER_SIZE;
		collider.Massless = true;
		collider.CollisionGroup = CharacterPhysics.PHYSICS_GROUP_CHARACTER_COLLIDER;
		collider.Transparency = 1;
		collider.Shape = Enum.PartType.Ball;

		const rigidAttachment = new Instance("Attachment");

		rigidAttachment.CFrame = new CFrame(CharacterPhysics.CHARACTER_COLLIDER_OFFSET).mul(CFrame.fromEulerAnglesXYZ(0, math.pi / 2, math.pi / 2));
		rigidAttachment.Parent = collider;

		const rigid = new Instance("RigidConstraint");

		rigid.Attachment0 = rigidAttachment;
		rigid.Attachment1 = (collider.Parent as Model & { HumanoidRootPart: BasePart & { RootAttachment: Attachment } }).HumanoidRootPart.RootAttachment;

		rigid.Parent = collider;
	}

	@ServerSideOnly
	private initializeRig() {
		// Add prefab
		const rig = this.getGameObject().addInstancePrefabFromPath<Rig>(PathToRig);

		rig.ModelStreamingMode = Enum.ModelStreamingMode.Atomic;
		rig.Name = `${this.getFaction()?.name.getValue()}${this.getId()}`;

		rig.GetDescendants().forEach(child => {
			if (child.IsA("BasePart")) child.CollisionGroup = CharacterPhysics.PHYSICS_GROUP_CHARACTER;
		});

		this.rig.setValue(rig);

		// Set Humanoid properties
		const humanoid = this.getHumanoid();

		humanoid.SetStateEnabled(Enum.HumanoidStateType.FallingDown, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.Flying, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.PlatformStanding, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.StrafingNoPhysics, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.RunningNoPhysics, false);
		humanoid.SetStateEnabled(Enum.HumanoidStateType.Ragdoll, false);

		// Initialize other
		this.initializeCollider();
	}

	//#region Callbacks
	public onAssignedAsCommander() {
		this.onIsCommanderChanged.fire(true);
	}

	public onRemovedAsCommander() {
		this.onIsCommanderChanged.fire(false);
	}

	private onDied() {
		this.died.fire();

		if (!Utilities.wasDestroyed(this) && RunService.IsServer()) this.getGameObject().destroy();
	}

	private onControllerChanged() {
		const currentController = this.getController();

		// need cleanup for controller.character
		if (this.lastController) {
			this.lastController.character = undefined!;

			this.lastController.disable();
		}

		if (currentController) {
			if (currentController.character !== this) currentController.character = this;

			currentController.enable();
		}

		this.lastController = currentController;
	}

	public onStart(): void {
		CharacterManager.onCharacterAdded(this);
		
		this.unitBinder.start();
		this.controller.onValueChanged.connect(() => this.onControllerChanged());

		if (RunService.IsServer()) {
			// needs refinement
			this.initializeRig();

			this.rig.getValue().PivotTo(SpawnLocation.getSpawnLocationOfFaction(this.unit.getValue().getFaction()?.name.getValue() ?? "")?.getGameObject().getInstance().GetPivot() ?? CFrame.identity);
			// this.rig.getValue().PivotTo(new CFrame((math.random() * 2 - 1) * 1024, 0, (math.random() * 2 - 1) * 1024));

			if (!this.getController()) this.setController(this.getFallbackController());
		}

		this.rig.waitForValue().then(() => {
			// Setup callbacks
			this.collector.add(this.getHumanoid().Died.Connect(() => this.onDied()));
		});
	}

	public willRemove(): void {
		if (RunService.IsServer()) this.setController(undefined);

		this.collector.teardown();
		this.unitBinder.teardown();
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	//#region Getters
	/**
	 * Returns whether or not this Character is the commander of its units
	 */
	public isCommander(): boolean {
		const unit = this.unit.getValue();

		return unit && unit.commander.getValue() === this;
	}

	public getHumanoid(): Humanoid {
		return this.rig.getValue().FindFirstChild("Humanoid") as Humanoid;
	}

	public hasRig(): boolean {
		return this.rig.getValue() !== undefined;
	}

	public getFaction(): Faction | undefined {
		return (this.unit.getValue() as BattleUnit | CommandUnit).getFaction();
	}

	public getController(): BattleController {
		return this.controller.getValue();
	}

	public getFallbackController(): BattleController {
		if (!this.fallbackController) this.fallbackController = this.getGameObject().addComponent(Character.defaultController, {
			character: this
		});

		return this.fallbackController;
	}

	//#region Setters
	public setController(controller: BattleController | undefined) {
		this.controller.setValue(controller!);
	}
}