import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";

export abstract class Action extends NetworkBehavior {
	abstract activate(): void;
	abstract cancel(soft: boolean): void;
}