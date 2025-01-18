import { StarterPlayer } from "@rbxts/services";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { PlayerBehavior } from "CONTACT ONE/shared/players/PlayerBehavior";
import { PlayerManager } from "CONTACT ONE/shared/players/PlayerManager";
import { BattleUnit } from "CONTACT ONE/shared/stacks/organization/BattleUnit";
import { CommandUnit } from "CONTACT ONE/shared/stacks/organization/CommandUnit";
import { ElementManager } from "CONTACT ONE/shared/stacks/organization/ElementManager";
import { ORBAT } from "CONTACT ONE/shared/stacks/organization/ORBAT";
import { TestTemplate } from "CONTACT ONE/shared/stacks/organization/templating/TestTemplate";
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { CORP } from "CORP/shared/Scripts/CORP";
import { NetworkObject } from "CORP/shared/Scripts/Networking/NetworkObject";
import { SceneManager } from "CORP/shared/Scripts/Scenes/SceneManager";
import { SceneSerialization } from "CORP/shared/Scripts/Serialization/SceneSerialization";
import MainScene from "./MainScene.json";

(StarterPlayer.WaitForChild("StarterPlayerScripts") as StarterPlayerScripts).WaitForChild("PlayerScriptsLoader").Destroy();

CORP.start({
	startingScene: MainScene as unknown as SceneSerialization.SceneDescription
});

PlayerManager.setPlayerComponent(PlayerBehavior);

function createChar(d?: Partial<Character>) {
	const c = new GameObject();

	c.setParent(SceneManager.currentScene);
	c.addComponent(NetworkObject);
	return c.addComponent(Character);
}

function createCommandUnit(d?: Partial<CommandUnit>) {
	const c = new GameObject();

	c.setParent(SceneManager.currentScene);
	c.addComponent(NetworkObject);

	return c.addComponent(CommandUnit);
}

function createBattleUnit(d?: Partial<BattleUnit>) {
	const c = new GameObject();

	c.setParent(SceneManager.currentScene);
	c.addComponent(NetworkObject);

	return c.addComponent(BattleUnit, d);
}

const q: ORBAT = {
	factions: [
		{
			name: "AGF",
			rootUnits: [TestTemplate]
		}
	]
};
ElementManager.instantiateORBAT(q);
// print(ElementManager.instantiateTemplate(undefined, TestTemplate).getId());

// const mainCom = createCommandUnit();

// const char1 = createChar();
// char1.unit.setValue(mainCom);
// mainCom.commander.setValue(char1);

// const mainBat = createBattleUnit();

// const char2 = createChar();
// char2.unit.setValue(mainBat);
// mainBat.commander.setValue(char2);
