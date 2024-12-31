import { CORP } from "CORP/shared/Scripts/CORP";
import { SceneSerialization } from "CORP/shared/Scripts/Serialization/SceneSerialization";
import MainScene from "./MainScene.json";

CORP.start({
	startingScene: MainScene as unknown as SceneSerialization.SceneDescription
});