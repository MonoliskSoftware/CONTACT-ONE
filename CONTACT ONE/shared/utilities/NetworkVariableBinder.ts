import { LogGroup } from "../Libraries/Logging";
import { Connection } from "../Libraries/Signal";
import { dict } from "../Libraries/Utilities";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { Networking } from "../Scripts/Networking/Networking";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { SpawnManager } from "../Scripts/Networking/SpawnManager";

const NetworkVariableBinderLogGroup = {
	enabled: true,
	prefix: "NETWORK_VARIABLE_BINDER"
} satisfies LogGroup;

type MethodsWithArg<T, C> = {
	[K in keyof T]: T[K] extends (arg: C) => void ? K : never;
}[keyof T];

/**
 * Utility for listening to network changes that involve running a certain method on the value of the variable.
 */
export class NetworkVariableBinder<T extends Networking.NetworkableTypes, C extends NetworkBehavior> {
	protected lastValue: T | undefined;
	protected behavior: C;
	protected variable: NetworkVariable<T>;
	protected activation: MethodsWithArg<T, C>;
	protected deactivation: MethodsWithArg<T, C>;
	protected id = math.random();
	private valueChangedConnection: Connection<[T]>;

	constructor(behavior: C, variable: NetworkVariable<T>, activation: MethodsWithArg<T, C>, deactivation: MethodsWithArg<T, C>) {
		this.activation = activation;
		this.deactivation = deactivation;
		this.behavior = behavior;
		this.variable = variable;
		this.valueChangedConnection = variable.onValueChanged.connect(value => this.apply(value));
	}

	public start() {
		this.apply(this.variable.getValue());
	}

	public teardown() {
		this.apply(undefined);

		this.lastValue = undefined;

		this.valueChangedConnection.disconnect();

		(this as dict).behavior = undefined;
		(this as dict).variable = undefined;
	}

	private apply(value: T | undefined) {
		if (value !== this.lastValue) {
			if (this.lastValue !== undefined) ((this.lastValue)?.[this.deactivation] as (this: T, behavior: C) => void)(this.behavior);
			if (value !== undefined) ((value)?.[this.activation] as (this: T, behavior: C) => void)(this.behavior);

			this.lastValue = value;
		}
	}
}

export class NetworkBehaviorVariableBinder<T extends NetworkBehavior, C extends NetworkBehavior> extends NetworkVariableBinder<T, C> {
	private behaviorDestroyingConnection: Connection<[NetworkBehavior]>;

	constructor(behavior: C, variable: NetworkVariable<T>, activation: MethodsWithArg<T, C>, deactivation: MethodsWithArg<T, C>) {
		super(behavior, variable, activation, deactivation);

		this.behaviorDestroyingConnection = SpawnManager.onNetworkBehaviorDestroying.connect(behavior => {
			if (behavior === this.lastValue) this.lastValue = undefined;
		});
	}

	public override teardown(): void {
		super.teardown();

		this.behaviorDestroyingConnection.disconnect();
	}
}