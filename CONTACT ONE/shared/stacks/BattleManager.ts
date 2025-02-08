/* eslint-disable @typescript-eslint/no-explicit-any */
import { Character } from "../characters/Character";
import { GameState, GameStateManager } from "../flow/GameStateManager";
import { Path } from "../Libraries/Path";
import { ServerSideOnly } from "../Libraries/Utilities";
import { GameObject } from "../Scripts/Componentization/GameObject";
import { ExtractNetworkVariables, NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { Networking } from "../Scripts/Networking/Networking";
import { NetworkObject } from "../Scripts/Networking/NetworkObject";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { Scene } from "../Scripts/Scenes/Scene";
import { SceneManager } from "../Scripts/Scenes/SceneManager";
import { BaseElement } from "./organization/elements/BaseElement";
import { BattleUnit } from "./organization/elements/BattleUnit";
import { CommandUnit } from "./organization/elements/CommandUnit";
import { Faction } from "./organization/elements/Faction";
import { UnitTemplates } from "./organization/templating/UnitTemplates";
import { UnitProfiles } from "./organization/UnitProfiles";
import { Scenarios } from "./Scenarios";
import { GameStack } from "./StackManager";

function createNetworkedGameObject(name: string = "GameObject", parent: GameObject | Scene | undefined = SceneManager.currentScene) {
	const gameObject = new GameObject();

	gameObject.setParent(parent);
	gameObject.setName(name);
	gameObject.addComponent(NetworkObject);

	return gameObject;
}

export class BattleManager extends NetworkBehavior {
	private static singleton: BattleManager;

	public readonly currentScenario = new NetworkVariable<Scenarios.ORBAT>(this, undefined as unknown as Scenarios.ORBAT);

	constructor(gameObject: GameObject) {
		super(gameObject);

		BattleManager.singleton = this;
	}

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	/**
	 * Imports a unit based on the template provided and returns it.
	 * 
	 * @param parent Parent to set the new unit to.
	 * @param template Template to import.
	 * @param index Index in subordinates of the new unit.
	 * @returns Newly created unit.
	 */
	@ServerSideOnly
	public importUnit(parent: BaseElement<any>, template: UnitTemplates.Template, index: number) {
		const constructor = template.stack === GameStack.COMMAND_STACK ? CommandUnit : BattleUnit;
		const name = template.nameOverride ?? UnitProfiles.generateName(template.sizeProfile, template.classProfile, index);

		const unit = createNetworkedGameObject(name, parent.getGameObject()).addComponent<CommandUnit | BattleUnit>(constructor, {
			initialNetworkVariableStates: ({
				parent: parent as unknown as Faction,
				name: name,
				sizeProfile: template.sizeProfile,
				classProfile: template.classProfile
			} satisfies ExtractNetworkVariables<CommandUnit | BattleUnit> as unknown as Map<string, Networking.NetworkableTypes>)
		});

		UnitTemplates.flattenNestedArray(template.subordinates).forEach((subTemplate, index) => this.importUnit(unit, subTemplate, index + 1));
		UnitTemplates.flattenNestedArray(template.members).forEach((loadout, index) => {
			const gameObject = createNetworkedGameObject("Character", unit.getGameObject());

			const char = gameObject.addComponent(Character, {
				initialNetworkVariableStates: ({
					unit: unit
				} satisfies ExtractNetworkVariables<Character> as unknown as Map<string, Networking.NetworkableTypes>)
			});

			if (index === 0) unit.commander.setValue(char);

			const fact = unit instanceof CommandUnit ? unit.getFaction() : unit.getCommandUnit()?.getFaction();

			char.getHumanoid().SetAttribute("Faction", fact?.getId());

			loadout.tools.forEach(path => {
				const t = Path.resolve(path)?.Clone();

				if (t) {
					t.Parent = char.rig.getValue();

					char.getHumanoid().EquipTool(t as Tool);
				}
			});
		});

		return unit;
	}

	@ServerSideOnly
	public importFaction(description: Scenarios.FactionDescription): Faction {
		const faction = createNetworkedGameObject(description.name).addComponent(Faction, {
			initialNetworkVariableStates: ({
				name: description.name
			} satisfies ExtractNetworkVariables<Faction> as unknown as Map<string, Networking.NetworkableTypes>)
		});

		description.rootUnits.forEach((template, index) => this.importUnit(faction, template, index + 1));

		return faction;
	}

	private listenToWinCondition(condition: Scenarios.WinCondition) {
		if (condition.type === "FactionElimination") {
			const factionCondition = condition as Scenarios.FactionEliminationCondition;
			const faction = Faction.factions.get(factionCondition.losingFaction);

			faction!.eliminated.connect(() => GameStateManager.getSingleton().onWin({
				winningFaction: (condition as { winFaction: string }).winFaction,
				wasStalemate: (condition as { stalemate: boolean }).stalemate
			}));
		}
	}

	@ServerSideOnly
	public loadORBAT(orbat: Scenarios.ORBAT) {
		const gameStateManager = GameStateManager.getSingleton();

		gameStateManager.state.setValue(GameState.PREPARATION);

		orbat.factions.forEach(faction => this.importFaction(faction));
		orbat.winConditions.forEach(condition => this.listenToWinCondition(condition));

		gameStateManager.state.setValue(GameState.ACTION);
	}

	public static getSingleton() {
		return this.singleton;
	}
}