export namespace EnvironmentDescriptions {
	/**
	 * Describes baked lighting settings which would not be affected by the {@link LightingState}.
	 */
	export interface BakedLightingDescription {
		skyBox: Partial<Sky>
	}

	export interface LightingState {
		/**
		 * Decimal from 0-24 describing the time of day.
		 */
		timeOfDay: number;
		/**
		 * Decimal from 0-1 describing how cloudy the environment is.
		 */
		cloudiness: number;
	}
}