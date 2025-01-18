import { Character } from "CONTACT ONE/shared/characters/Character";
import { Signal } from "CORP/shared/Libraries/Signal";
import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";

/**
 * BaseElements are an abstract class the commandable units extend from.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class BaseElement<C extends BaseElement<any>> extends NetworkBehavior {
	public readonly directMembers: Character[] = [];
	public readonly name = new NetworkVariable<string>(this, "Unit");

	public abstract readonly subordinates: C[];
	public readonly subordinateAdded = new Signal<[C]>(`${this.getId()}SubordinateAdded`);
	public readonly subordinateRemoving = new Signal<[C]>(`${this.getId()}SubordinateRemoving`);

	/**
	 * Callback used when children are parented to this Unit. This should only be used by those subordinates.
	 * 
	 * @param subordinate Unit being added as a subordinate.
	 */
	public abstract subordinateOnAdded(subordinate: C): void;

	/**
	 * Callback used when children are unparented from this Unit. This should only be used by those subordinates.
	 * 
	 * @param subordinate Unit being removed as a subordinate.
	 */
	public abstract subordinateOnRemoved(subordinate: C): void;
}