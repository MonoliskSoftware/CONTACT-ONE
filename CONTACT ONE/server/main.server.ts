import { StarterPlayer } from "@rbxts/services";
import { CORP } from "CORP/shared/Scripts/CORP";
import { SceneSerialization } from "CORP/shared/Scripts/Serialization/SceneSerialization";
import MainScene from "./MainScene.json";

(StarterPlayer.WaitForChild("StarterPlayerScripts") as StarterPlayerScripts).WaitForChild("PlayerScriptsLoader").Destroy();

CORP.start({
	startingScene: MainScene as unknown as SceneSerialization.SceneDescription
});