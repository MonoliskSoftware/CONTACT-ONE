import { GameObject } from "../Scripts/Componentization/GameObject";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { RPC, RPCAllowedEndpoints } from "../Scripts/Networking/RPC";
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
		allowedEndpoints: RPCAllowedEndpoints.CLIENT_TO_SERVER
	})
	public requestFactionAssignment(factionId: string, params: RPC.RPCIncomingParams = RPC.DefaultIncomingParams) {
		assert(params.sender);

		const faction = SpawnManager.getNetworkBehaviorById(factionId) as Faction | undefined;

		assert(faction, `Bad faction id: ${factionId}`);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		behavior.faction.setValue(faction);
	} 

	@RPC.Method({
		allowedEndpoints: RPCAllowedEndpoints.CLIENT_TO_SERVER
	})
	public requestUnitCommandAssumption(unitId: string, params: RPC.RPCIncomingParams = RPC.DefaultIncomingParams) {
		assert(params.sender);

		const unit = SpawnManager.getNetworkBehaviorById(unitId) as CommandUnit | undefined;

		assert(unit !== undefined, `Bad unit id: ${unitId}`);
		assert(unit instanceof CommandUnit, `Unit must be a CommandUnit.`);

		const behavior = PlayerManager.singleton.getBehaviorFromPlayer(params.sender);

		assert(unit.getFaction() === behavior.faction.getValue(), `Unit is not owned by the faction of the requester.`);

		unit.controller.setValue(behavior);

		behavior.state.setValue(PlayerState.IN_GAME);
		behavior.stack.setValue(GameStack.COMMAND_STACK);
	}
}