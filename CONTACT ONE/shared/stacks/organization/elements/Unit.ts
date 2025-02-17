/* eslint-disable @typescript-eslint/no-explicit-any */
import { RunService } from "@rbxts/services";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { Formations } from "CONTACT ONE/shared/characters/Formations";
import { NetworkBehaviorVariableBinder } from "CONTACT ONE/shared/utilities/NetworkVariableBinder";
import { Connection, Signal } from "CORP/shared/Libraries/Signal";
import { ServerSideOnly } from "CORP/shared/Libraries/Utilities";
import { NetworkList } from "CORP/shared/Scripts/Networking/NetworkList";
import { NetworkVariable } from "CORP/shared/Scripts/Networking/NetworkVariable";
import { GameStack } from "../../StackManager";
import { UnitProfiles } from "../templating/UnitProfiles";
import { BaseElement } from "./BaseElement";
import { Faction } from "./Faction";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type GenericUnit = Unit<BaseElement<any>, BaseElement<any>>;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export abstract class Unit<P extends BaseElement<any>, C extends BaseElement<any>> extends BaseElement<C> {
	/**
	 * A reference to the commander of this element.
	 */
	public readonly commander = new NetworkVariable<Character>(this, undefined!);

	private readonly commanderBinder = new NetworkBehaviorVariableBinder(this as Unit<P, C>, this.commander, "onAssignedAsCommander", "onRemovedAsCommander");

	public readonly formation = new NetworkVariable(this, Formations.FormationType.FILE);

	/**
	 * Profile describing sizing info about this unit.
	 */
	public readonly sizeProfile = new NetworkVariable<UnitProfiles.SizeProfile>(this, undefined!);

	/**
	 * Profile describing class info about this unit.
	 */
	public readonly classProfile = new NetworkVariable<UnitProfiles.ClassProfile>(this, undefined!);

	/**
	 * An array containing the Characters directly in this unit.
	 */
	public readonly directMembers: Character[] = [];

	/**
	 * The parent Element of this unit.
	 */
	public readonly parent = new NetworkVariable<P>(this, undefined!);

	private readonly parentBinder = new NetworkBehaviorVariableBinder<BaseElement<any>, Unit<P, C>>(this, this.parent as unknown as NetworkVariable<BaseElement<any>>, "subordinateOnAdded", "subordinateOnRemoved");

	/**
	 * Specifies what stack this Unit class belongs to.
	 */
	public abstract readonly stack: GameStack;

	public readonly knownTargets = new NetworkList<Character>(this);

	private targetDiedConnections: Connection<[]>[] = [];

	public readonly memberRemoved = new Signal<[Character]>(`memberRemoved`);
	public readonly memberAdded = new Signal<[Character]>(`memberAdded`);

	/**
	 * Returns a recursively fetched array of all units descending from this one.
	 */
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	public getDescendants(): (C | Unit<any, any>)[] {
		return this.subordinates.reduce((descendants, child) => [...descendants, ...(child instanceof Unit ? child.getDescendants() : [])], [...this.subordinates]);
	}

	public abstract getFaction(): Faction;

	public memberOnAdded(member: Character) {
		if (!this.directMembers.includes(member)) {
			this.directMembers.push(member);

			this.memberAdded.fire(member);
		}
	}

	public memberOnRemoving(member: Character) {
		if (this.directMembers.includes(member)) {
			if (RunService.IsServer() && (member === this.commander.getValue() || !this.commander.getValue())) this.assignNewCommander(member);

			this.directMembers.remove(this.directMembers.indexOf(member));

			this.memberRemoved.fire(member);

			if (RunService.IsServer()) this.checkIfShouldDestroy();
		}
	}

	@ServerSideOnly
	private assignNewCommander(ignoreMember: Character) {
		print(`Changing commander for ${this.getId()}`);

		this.commander.setValue(this.directMembers.find(otherMember => otherMember !== ignoreMember) as Character);
	}

	public willRemove(): void {
		this.commanderBinder.teardown();
		this.parentBinder.teardown();

		this.targetDiedConnections.forEach(connection => connection.disconnect());
		this.targetDiedConnections.clear();

		if (RunService.IsServer()) this.parent.setValue(undefined as unknown as P);
	}

	@ServerSideOnly
	protected checkIfShouldDestroy(ignoreSubordinate?: Unit<any, any>): void {
		warn(`${this.name.getValue()} now has ${this.directMembers.size()} members and ${this.subordinates.size()} subordinates!`);

		if (this.directMembers.size() === 0 && (this.subordinates.size() === 0 || (this.subordinates.size() === 1 && this.subordinates.includes(ignoreSubordinate as unknown as C)))) {
			let unit = this.parent;

			while (unit instanceof Unit) {
				const tempUnit = unit;

				unit = unit.parent;

				tempUnit.checkIfShouldDestroy(this);
			}

			this.getGameObject().destroy();
		}
	}

	public onStart(): void {
		this.commanderBinder.start();
		this.parentBinder.start();

		// task.defer(() => {
		// 	if (this.sizeProfile.getValue().acronym === "S") {
		// 		const com = this.commander.getValue();

		// 		const move = createMovement({
		// 			position: ((Workspace as dict).Target as Part).Position,
		// 			type: GoalType.PATHFIND_TO
		// 		});

		// 		const con = com.getController() as AIBattleController;

		// 		con.addMovement(move, 1000);
		// 		con.yieldUntilMovementCompleted(move).then(() => con.removeMovement(move));
		// 	}
		// });
	}

	public getMembersRecursive(): Character[] {
		return this.subordinates.reduce((accum, current) => [...accum, ...(current as unknown as Unit<any, any>).getMembersRecursive()], this.directMembers);
	}

	public tryReportTarget(target: Character) {
		if (!this.knownTargets.includes(target)) {
			this.knownTargets.push(target);

			this.targetDiedConnections.push(target.died.connect(() => this.knownTargets.setValue(this.knownTargets.getValue().filter(value => value !== target))));
		}
	}

	/**
	 * Method used by Character to find a new target.
	 */
	public requestTarget(): Character | undefined {
		return this.knownTargets.find(target => !this.directMembers.some(member => member.assignedTarget.getValue() === target));
	}
}