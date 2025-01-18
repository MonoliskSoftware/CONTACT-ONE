import { StarterPlayer } from "@rbxts/services";
import { PlayerBehavior } from "CONTACT ONE/shared/players/PlayerBehavior";
import { PlayerManager } from "CONTACT ONE/shared/players/PlayerManager";
import { BattleManager } from "CONTACT ONE/shared/stacks/BattleManager";
import { TestTemplate } from "CONTACT ONE/shared/stacks/organization/templating/TestTemplate";
import { Scenarios } from "CONTACT ONE/shared/stacks/Scenarios";
import { CORP } from "CORP/shared/Scripts/CORP";
import { SceneSerialization } from "CORP/shared/Scripts/Serialization/SceneSerialization";
import MainScene from "./MainScene.json";

(StarterPlayer.WaitForChild("StarterPlayerScripts") as StarterPlayerScripts).WaitForChild("PlayerScriptsLoader").Destroy();

CORP.start({
	startingScene: MainScene as unknown as SceneSerialization.SceneDescription
});

PlayerManager.setPlayerComponent(PlayerBehavior);

const q: Scenarios.ORBAT = {
	factions: [
		{
			name: "AGF",
			rootUnits: [TestTemplate]
		}
	]
};

BattleManager.loadORBAT(q);