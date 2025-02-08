import { NetworkBehavior } from "CORP/shared/Scripts/Networking/NetworkBehavior";
import { RPC } from "CORP/shared/Scripts/Networking/RPC";

/**
 * A test component demonstrating various RPC patterns
 */
export class TestRPCComponent extends NetworkBehavior {
    protected getSourceScript(): ModuleScript {
        return script as ModuleScript;
    }

    public onStart(): void {
        // Component initialization
    }

    public willRemove(): void {
        // Cleanup
    }

    /**
     * Basic server to client RPC that broadcasts a message
     */
    @RPC.Method({
        allowedEndpoints: RPC.AllowedEndpoints.SERVER_TO_CLIENT,
        returnMode: RPC.ReturnMode.DOES_NOT_RETURN
    })
    public broadcastMessage(message: string): void {
        print(`Received broadcast message: ${message}`);
    }

    /**
     * Client to server RPC that returns a value
     */
    @RPC.Method({
        allowedEndpoints: RPC.AllowedEndpoints.CLIENT_TO_SERVER,
        returnMode: RPC.ReturnMode.RETURNS
    })
    public requestData(dataId: string): string {
        return `Data for ID: ${dataId}`;
    }

    /**
     * Owner-only RPC with unreliable transmission
     */
    @RPC.Method({
        accessPolicy: RPC.AccessPolicy.OWNER,
        allowedEndpoints: RPC.AllowedEndpoints.ALL,
        reliability: RPC.Reliability.UNRELIABLE
    })
    public ownerUpdate(position: Vector3): void {
        this.getGameObject().getInstance().PrimaryPart?.PivotTo(new CFrame(position));
    }

    /**
     * Bidirectional RPC that includes sender information
     */
    @RPC.Method({
        allowedEndpoints: RPC.AllowedEndpoints.ALL
    })
    public syncAction(action: string, params: { [key: string]: unknown }, incomingParams: RPC.IncomingParams): void {
        print(`Action ${action} received from ${incomingParams.sender?.Name ?? "Server"}`);
        print(`Parameters:`, params);
    }
}