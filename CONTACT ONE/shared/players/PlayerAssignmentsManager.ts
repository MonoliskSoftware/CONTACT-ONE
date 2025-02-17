import { Character } from "../characters/Character";
import { GameObject } from "../Scripts/Componentization/GameObject";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { RPC } from "../Scripts/Networking/RPC";
import { SpawnManager } from "../Scripts/Networking/SpawnManager";
import { CommandUnit } from "../stacks/organization/elements/CommandUnit";
import { Faction } from "../stacks/organization/elements/Faction";
import { GameStack } from "../stacks/StackManager";
import { PlayerManager } from "./PlayerManager";
import { PlayerState } from "./PlayerState";

/**
 * The PlayerAssignmentsManager is used to manage the assignment of players to factions, units, etc.
 */
export class PlayerAssignmentsManager extends NetworkBehavior {
	public static singleton: PlayerAssignmentsManager;

	constructor(gameObject: GameObject) {
		super(gameObject);

		PlayerAssignmentsManager.singleton = this;
	}

	public onStart(): void {

	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER
	})
	public requestFactionAssignment(factionId: string, params: RPC.IncomingParams = RPC.DefaultIncomingParams) {
		assert(params.sender);

		const faction = SpawnManager.getNetworkBehaviorById(factionId) as Faction | undefined;

		assert(faction, `Bad faction id: ${factionId}`);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		behavior.faction.setValue(faction);
	} 

	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER
	})
	public requestUnitCommandAssumption(unitId: string, params: RPC.IncomingParams = RPC.DefaultIncomingParams) {
		assert(params.sender);

		const unit = SpawnManager.getNetworkBehaviorById(unitId) as CommandUnit | undefined;

		assert(unit !== undefined, `Bad unit id: ${unitId}`);
		assert(unit instanceof CommandUnit, `Unit must be a CommandUnit.`);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		assert(unit.getFaction() === behavior.faction.getValue(), `Unit is not owned by the faction of the requester.`);

		unit.controller.setValue(behavior);

		behavior.stack.setValue(GameStack.COMMAND_STACK);
		behavior.state.setValue(PlayerState.IN_GAME);
	}

	@RPC.Method({
		allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER
	})
	public requestCharacterAssignment(characterId: string, params: RPC.IncomingParams = RPC.DefaultIncomingParams) {
		assert(params.sender);

		const char = SpawnManager.getNetworkBehaviorById<Character>(characterId);

		assert(char !== undefined, `Bad character id: ${characterId}`);
		assert(char instanceof Character, `Not a character.`);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		assert(char.getFaction() === behavior.faction.getValue(), `Character is not owned by the faction of the requester.`);
	
		char.setController(behavior.getBattleController());

		behavior.stack.setValue(GameStack.BATTLE_STACK);
		behavior.state.setValue(PlayerState.IN_GAME);
	}
}