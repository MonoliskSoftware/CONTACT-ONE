import { Character } from "CONTACT ONE/shared/characters/Character";
import { Signal } from "CORP/shared/Libraries/Signal";
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { GameStack } from "../StackManager";

/**
 * BaseElements are an abstract class the commandable units extend from.
 */
export abstract class BaseElement extends NetworkBehavior {
	/**
	 * A reference to the commander of this element.
	 */
	public readonly commander = new NetworkVariable(this, undefined as unknown as Character);
	/**
	 * An array containing the Characters directly in this unit.
	 */
	public readonly directMembers: Character[] = [];
	public readonly name = new NetworkVariable<string>(this, "Unit");
	public readonly subordinateAdded = new Signal<[BaseElement]>(`${this.getId()}SubordinateAdded`);
	public readonly subordinateRemoving = new Signal<[BaseElement]>(`${this.getId()}SubordinateRemoving`);

	abstract getStack(): GameStack;

	abstract subordinates: BaseElement[];
}