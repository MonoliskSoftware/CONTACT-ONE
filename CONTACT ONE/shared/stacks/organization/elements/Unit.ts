/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { Formations } from "CONTACT ONE/shared/characters/Formations";
import { NetworkList } from "CORP/shared/Scripts/Networking/NetworkList";
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

	private lastCommander: Character | undefined;

	public readonly formation = new NetworkVariable(this, Formations.FormationType.FILE);

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

	public readonly knownTargets = new NetworkList<Character>(this, []);

	/**
	 * Returns a recursively fetched array of all units descending from this one.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public getDescendants(): (C | Unit<any, any>)[] {
		return this.subordinates.reduce((descendants, child) => [...descendants, ...(child instanceof Unit ? child.getDescendants() : [])], [...this.subordinates]);
	}

	public memberOnAdded(member: Character) {
		if (!this.directMembers.includes(member)) {
			this.directMembers.push(member);
		}
	}

	public memberOnRemoving(member: Character) {
		if (this.directMembers.includes(member)) {
			// print(this.directMembers.indexOf(member));

			this.directMembers.remove(this.directMembers.indexOf(member));

			this.checkIfShouldDestroy();
		}
	}

	public willRemove(): void {
		if (RunService.IsServer()) this.parent.setValue(undefined as unknown as P);
	}

	private checkIfShouldDestroy(): void {
		if (this.directMembers.size() === 0 && this.subordinates.size() === 0) {
			let unit = this.parent;

			while (unit instanceof Unit) {
				const tempUnit = unit;

				unit = unit.parent;

				tempUnit.checkIfShouldDestroy();
			}

			this.getGameObject().destroy();
		}
	}

	public onStart(): void {
		this.onCommanderChanged();

		this.commander.onValueChanged.connect(() => this.onCommanderChanged());
	}

	private onCommanderChanged() {
		const commander = this.commander.getValue();

		if (commander !== this.lastCommander) {
			this.lastCommander?.onIsCommanderChanged.fire(false);
			commander.onIsCommanderChanged.fire(true);

			this.lastCommander = commander;
		}
	}

	public getMembersRecursive(): Character[] {
		return this.subordinates.reduce((accum, current) => [...accum, ...(current as unknown as Unit<any, any>).getMembersRecursive()], this.directMembers);
	}

	public tryReportTarget(target: Character) {
		if (!this.knownTargets.includes(target)) {
			this.knownTargets.push(target);

			target.died.connect(() => this.knownTargets.setValue(this.knownTargets.getValue().filter(value => value !== target)));
		}
	}

	/**
	 * Method used by Character to find a new target.
	 */
	public requestTarget(): Character | undefined {
		return this.knownTargets.find(target => !this.directMembers.some(member => member.assignedTarget.getValue() === target));
	}
}