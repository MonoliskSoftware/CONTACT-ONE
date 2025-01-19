/**
 * Utility module for handling User Fast Flags
 */
export namespace FlagUtil {
	/**
	 * Gets the user fast flag value if it's available, otherwise returns false. Don't include flag prefix.
	 * 
	 * @example 
	 * ```ts
	 * const FFlagUserDoStuff = FlagUtil.getUserFlag("UserDoStuff");
	 * ``` 
	 */
	export function getUserFlag(flagName: string) {
		const [success, result] = pcall(() => UserSettings().IsUserFeatureEnabled(flagName));

		return success && result;
	}
}