import { Players, RunService } from "@rbxts/services";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { RPC, RPCAccessPolicy, RPCAllowedEndpoints, RPCReturnMode } from "../Scripts/Networking/RPC";

export class RPCTest extends NetworkBehavior {
	public onStart(): void {
		if (RunService.IsClient()) {
			if (this.getNetworkObject().isOwner()) {
				print(this.clientToServerTest(8, 9));
			} else {
				this.getNetworkObject().ownerChanged.connect(() => print(this.clientToServerTest(2, 44)));
			}
		}

		if (RunService.IsServer()) {
			Players.PlayerAdded.Connect(player => {
				this.getNetworkObject().changeOwnership(player);
				print(this.serverToClientTest(33333, "MAWMAWMAW"));
			});
		}
	}

	public willRemove(): void {

	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}

	@RPC.Method({
		allowedEndpoints: RPCAllowedEndpoints.CLIENT_TO_SERVER,
		returnMode: RPCReturnMode.RETURNS,
		accessPolicy: RPCAccessPolicy.OWNER
	})
	public clientToServerTest(param1: number, param2: number) {
		return param1 * param2;
	}

	@RPC.Method({
		allowedEndpoints: RPCAllowedEndpoints.SERVER_TO_CLIENT,
		returnMode: RPCReturnMode.RETURNS,
		accessPolicy: RPCAccessPolicy.OWNER
	})
	public serverToClientTest(param1: number, param2: string) {
		return 1040;
	}
}