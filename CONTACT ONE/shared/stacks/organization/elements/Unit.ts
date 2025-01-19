import { Character } from "CONTACT ONE/shared/characters/Character";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { GameStack } from "../../StackManager";
import { UnitProfiles } from "../UnitProfiles";
import { BaseElement } from "./BaseElement";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericUnit = Unit<BaseElement<any>, BaseElement<any>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class Unit<P extends BaseElement<any>, C extends BaseElement<any>> extends BaseElement<C> {
	/**
	 * A reference to the commander of this element.
	 */
	public readonly commander = new NetworkVariable(this, undefined as unknown as Character);

	/**
	 * Profile describing sizing info about this unit.
	 */
	public readonly sizeProfile = new NetworkVariable<UnitProfiles.SizeProfile>(this, undefined as unknown as UnitProfiles.SizeProfile);

	/**
	 * Profile describing class info about this unit.
	 */
	public readonly classProfile = new NetworkVariable<UnitProfiles.ClassProfile>(this, undefined as unknown as UnitProfiles.ClassProfile);

	/**
	 * An array containing the Characters directly in this unit.
	 */
	public readonly directMembers: Character[] = [];

	/**
	 * The parent Element of this unit.
	 */
	public readonly parent = new NetworkVariable<P>(this, undefined as unknown as P);

	/**
	 * Specifies what stack this Unit class belongs to.
	 */
	public abstract readonly stack: GameStack;

	/**
	 * Returns a recursively fetched array of all units descending from this one.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public getDescendants(): (C | Unit<any, any>)[] {
		return this.subordinates.reduce((descendants, child) => [...descendants, ...(child instanceof Unit ? child.getDescendants() : [])], [...this.subordinates]);
	}
}