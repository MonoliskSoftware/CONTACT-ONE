import { Players } from "@rbxts/services";
import { Connection, Signal } from "CORP/shared/Libraries/Signal";
import { ConnectionUtil } from "./ConnectionUtil";

const CONNECTIONS = {
	LOCAL_PLAYER: "LOCAL_PLAYER",
	ON_LOCAL_PLAYER: "ON_LOCAL_PLAYER",
	CHARACTER_ADDED: "CHARACTER_ADDED",
	ON_CHARACTER: "ON_CHARACTER",
	CHARACTER_CHILD_ADDED: "CHARACTER_CHILD_ADDED",
};

/**
 * Utility for handing LocalPlayer, Character and instances under Character (including Humanoid)
 * 
 * This is a static class.
 */
export class CharacterUtil {
	/**
	 * Returns the LocalPlayer if it exists
	 */
	public static getLocalPlayer(): Player | undefined {
		return Players.LocalPlayer;
	}

	/**
	 * Runs the function with the LocalPlayer when it is available (which may be immediately)
	 */
	public static onLocalPlayer(func: (player: Player) => void): Connection<[Player]> {
		const localPlayer = CharacterUtil.getLocalPlayer();

		if (localPlayer) func(localPlayer);

		// connect to potential local player changes
		CharacterUtil._connectionUtil.trackConnection(
			CONNECTIONS.LOCAL_PLAYER,
			Players.GetPropertyChangedSignal("LocalPlayer").Connect(() => {
				const localPlayer = CharacterUtil.getLocalPlayer();

				assert(localPlayer);

				(CharacterUtil._getOrCreateBoundEvent(CONNECTIONS.LOCAL_PLAYER) as unknown as Signal<[Player]>).fire(localPlayer);
			})
		);

		const boundEvent = CharacterUtil._getOrCreateBoundEvent(CONNECTIONS.LOCAL_PLAYER);

		return (boundEvent as unknown as Signal<[Player]>).connect(plr => func(plr));
	}

	/**
	 * Returns the Character if it exists
	 */
	public static getCharacter(): Model | undefined {
		const localPlayer = CharacterUtil.getLocalPlayer();

		return localPlayer?.Character;
	}

	/**
	 * Runs the function with the Character when it is available
	 * and anytime it changes
	 */
	public static onCharacter(func: (char: Model) => void): RBXScriptConnection {
		CharacterUtil._connectionUtil.trackConnection(
			CONNECTIONS.ON_LOCAL_PLAYER,
			// check the character every time the local player changes
			CharacterUtil.onLocalPlayer(localPlayer => {
				const character = CharacterUtil.getCharacter();

				if (character) func(character);

				CharacterUtil._connectionUtil.trackConnection(
					CONNECTIONS.CHARACTER_ADDED,
					// alert character connections on CharacterAdded
					localPlayer.CharacterAdded.Connect(newCharacter => {
						assert(newCharacter);
						(CharacterUtil._getOrCreateBoundEvent(CONNECTIONS.CHARACTER_ADDED) as unknown as Signal<[Player]>).fire(newCharacter); // reuse connnection key for boundEvents
					})
				);
			}) as unknown as RBXScriptConnection
		);
	}

	/**
	 * Returns the Instance under the Character with the given name if it exists
	 */
	public static getChild(name: string, className: string): Instance | undefined {

	}

	/**
	 * Runs the function with the Instance under the Character with the given name when it is available
	 * and anytime it changes
	 */
	public static onChild(name: string, className: string, func: (child: Instance) => void): RBXScriptConnection {

	}

	/**
	 * stores connections to engine APIs which may change LocalPlayer, Character or instances under Character
	 */
	public static _connectionUtil = new ConnectionUtil();

	/**
	 * stores BindableEvents to tell interested parties when LocalPlayer, Character or instances under Character become valid
	 */
	public static _boundEvents = new Map<string, Signal<[]>>();

	/**
	 * gets the BindableEvent for the given name, creating it if it doesn't exist
	 */
	public static _getOrCreateBoundEvent: (name: string) => Signal<[]>;
}