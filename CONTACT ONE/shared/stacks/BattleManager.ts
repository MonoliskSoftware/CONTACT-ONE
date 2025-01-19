import { Character } from "../characters/Character";
import { Path } from "../Libraries/Path";
import { GameObject } from "../Scripts/Componentization/GameObject";
import { ExtractNetworkVariables } from "../Scripts/Networking/NetworkBehavior";
import { Networking } from "../Scripts/Networking/Networking";
import { NetworkObject } from "../Scripts/Networking/NetworkObject";
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

export class BattleManager {
	/**
	 * Imports a unit based on the template provided and returns it.
	 * 
	 * @param parent Parent to set the new unit to.
	 * @param template Template to import.
	 * @param index Index in subordinates of the new unit.
	 * @returns Newly created unit.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public static importUnit(parent: BaseElement<any>, template: UnitTemplates.Template, index: number) {
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

			unit.directMembers.push(char);

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

	public static importFaction(description: Scenarios.FactionDescription): Faction {
		const faction = createNetworkedGameObject(description.name).addComponent(Faction, {
			initialNetworkVariableStates: ({
				name: description.name
			} satisfies ExtractNetworkVariables<Faction> as unknown as Map<string, Networking.NetworkableTypes>)
		});

		description.rootUnits.forEach((template, index) => this.importUnit(faction, template, index + 1));

		return faction;
	}

	public static loadORBAT(orbat: Scenarios.ORBAT) {
		orbat.factions.forEach(faction => this.importFaction(faction));
	}
}