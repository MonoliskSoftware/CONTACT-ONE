import { BaseController } from "CONTACT ONE/shared/controllers/BaseController";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { BaseElement } from "./BaseElement";
import { BattleUnit } from "./BattleUnit";

/**
 * Command units are the highest level in the org hierarchy. The subordinates of a Command unit are always Battle units.
 */
export class CommandUnit extends BaseElement {
	public readonly subordinates: BattleUnit[] = [];
	public readonly owner = new NetworkVariable<BaseController>(this, undefined as unknown as BaseController);

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}