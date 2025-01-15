import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { ExtractNetworkVariables } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { Networking } from "CORP/shared/Scripts/Networking/Networking";
import { NetworkObject } from "CORP/shared/Scripts/Networking/NetworkObject";
import { SceneManager } from "CORP/shared/Scripts/Scenes/SceneManager";
import { GameStack } from "../StackManager";
import { BaseElement } from "./BaseElement";
import { BattleUnit } from "./BattleUnit";
import { CommandUnit } from "./CommandUnit";
import { Faction } from "./Faction";
import { ORBAT, ORBATFaction } from "./ORBAT";
import { UnitTemplate } from "./templating/Templates";

export class ElementManager {
	private static createCommandUnit(gameObject: GameObject, parent: Faction | undefined, template: UnitTemplate): CommandUnit {
		const element = gameObject.addComponent(CommandUnit, {
			initialNetworkVariableStates: ({
				parent: parent,
				name: template.name
			} satisfies ExtractNetworkVariables<CommandUnit> as unknown as Map<string, Networking.NetworkableTypes>)
		});

		return element;
	}

	private static createBattleUnit(gameObject: GameObject, parent: BaseElement, template: UnitTemplate): BattleUnit {
		const element = gameObject.addComponent(BattleUnit, {
			initialNetworkVariableStates: ({
				parent: parent as BattleUnit | CommandUnit,
				name: template.name
			} satisfies ExtractNetworkVariables<BattleUnit> as unknown as Map<string, Networking.NetworkableTypes>)
		});

		return element;
	}

	private static createFaction(gameObject: GameObject, description: ORBATFaction): Faction {
		const element = gameObject.addComponent(Faction, {
			initialNetworkVariableStates: ({
				// parent: parent as BattleUnit | CommandUnit,
				// name: template.name
			} satisfies ExtractNetworkVariables<Faction> as unknown as Map<string, Networking.NetworkableTypes>)
		});

		return element;
	}

	public static instantiateTemplate(parent: Faction | BaseElement | undefined, template: UnitTemplate): BaseElement {
		const gameObject = new GameObject();

		gameObject.setParent(parent ? parent.getGameObject() : SceneManager.currentScene);
		gameObject.setName(template.name);
		gameObject.addComponent(NetworkObject);

		const element = template.stack === GameStack.COMMAND_STACK ?
			this.createCommandUnit(gameObject, parent as Faction | undefined, template) :
			this.createBattleUnit(gameObject, parent as BaseElement, template);

		template.subordinates.forEach(subordinate => this.instantiateTemplate(element, subordinate));

		return element;
	}

	public static instantiateORBAT(orbat: ORBAT) {
		orbat.factions.forEach(factionDescription => {
			const gameObject = new GameObject();

			gameObject.setParent(SceneManager.currentScene);
			gameObject.setName(factionDescription.name);
			gameObject.addComponent(NetworkObject);

			const faction = ElementManager.createFaction(gameObject, factionDescription);

			factionDescription.rootUnits.forEach(unit => this.instantiateTemplate(faction, unit));
		});
	}
}