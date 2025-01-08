/**
 * Utility module for handling RBXScriptConnections. This module is used to track connections and disconnect them when needed.
 */
export class ConnectionUtil {
	_connections = new Map<string, () => void>();

	/**
	 * Connect with an RBXScripConnection
	 */
	trackConnection(key: string, connection: RBXScriptConnection): void {
		const disconnectionFunc = this._connections.get(key);

		if (disconnectionFunc) disconnectionFunc(); // Disconnect existing connection
		// store the disconnect function
		this._connections.set(key, () => connection.Disconnect());
	}

	/**
	 * Adds a manual disconnect function
	 */
	trackBoundFunction(key: string, disconnectionFunc: () => void): void {
		const tempDisconnectionFunc = this._connections.get(key);

		if (tempDisconnectionFunc) tempDisconnectionFunc();

		this._connections.set(key, disconnectionFunc);
	}

	/**
	 * Disconnects the key
	 */
	disconnect(key: string): void {
		const disconnectionFunc = this._connections.get(key);

		if (disconnectionFunc) {
			disconnectionFunc();

			this._connections.delete(key);
		}
	}

	/**
	 * Disconnects all connections on this util
	 */
	disconnectAll(): void {
		this._connections.forEach(func => func());

		this._connections.clear();
	}
}