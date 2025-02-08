export enum PlayerState {
	/**
	 * The player is in the lobby, choosing a side.
	 */
	LOBBY,
	/**
	 * The player is playing in game.
	 */
	IN_GAME,
	/**
	 * The player has been eliminated, and is waiting for a request to return to the lobby.
	 */
	ELIMINATED,
	/**
	 * The player is in debriefing, after the scenario has completed.
	 */
	DEBRIEFING,
	/**
	 * Fallback
	 */
	OTHER
}