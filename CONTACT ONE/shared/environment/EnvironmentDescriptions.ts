export namespace EnvironmentDescriptions {
	/**
	 * Describes baked lighting settings which would not be affected by the {@link LightingState}.
	 */
	export interface BakedLightingDescription {
		skyBox: Partial<Sky>;
		/**
		 * The OutdoorAmbient of this environment.
		 */
		ambient: Color3;
		/**
		 * @see {@link Lighting.EnvironmentSpecularScale}
		 */
		specularScale: number;
		brightness: number;
		effects: ["ColorCorrectionEffect" | "BloomEffect", (Partial<ColorCorrectionEffect> | Partial<BloomEffect>)][];
	}

	/**
	 * Describes the current lighting state.
	 */
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

	/**
	 * Describes how lighting states should change over time.
	 */
	export interface LightingUpdatesState {
		/**
		 * Whether the time of day should change over time.
		 */
		timeDoesProgress: boolean;
		/**
		 * How long a full day cycle takes, in seconds.
		 */
		dayLength: number;
	}
}