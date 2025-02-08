export enum StackBehaviorState {
	/**
	 * Yielding for player to load map contents
	 */
	INITIALIZING,
	/**
	 * Main state of StackBehaviors.
	 * 
	 * Core functions and behaviors should be ran when in this state.
	 */
	READY,
	/**
	 * Player has been eliminated or has died.
	 * 
	 * Elimination effects should be done here.
	 */
	ELIMINATED,
}