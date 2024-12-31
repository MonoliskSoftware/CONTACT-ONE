import { Behavior } from "CORP/shared/Scripts/Componentization/Behavior";
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { EnvironmentDescriptions } from "./EnvironmentDescriptions";

const q = {
	skyBox: {

	}
} satisfies EnvironmentDescriptions.BakedLightingDescription;

export class EnvironmentManager extends Behavior {
	private static singleton: EnvironmentManager;

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	public onStart(): void {
		print("hi");
	}

	public willRemove(): void {
		
	}

	constructor(gameObject: GameObject) {
		super(gameObject);

		EnvironmentManager.singleton = this;
	}

	/**
	 * @returns Current singleton EnvironmentManager.
	 */
	public static getSingleton(): EnvironmentManager {
		return EnvironmentManager.singleton;
	}
}