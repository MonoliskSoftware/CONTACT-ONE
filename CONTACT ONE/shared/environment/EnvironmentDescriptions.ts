/* eslint-disable @typescript-eslint/no-explicit-any */

export namespace EnvironmentDescriptions {
	export type PostEffectClasses = { [P in "ColorCorrectionEffect" | "BloomEffect" | "SunRaysEffect"]: CreatableInstances[P] }

	export type LightingEffectDescription<T extends keyof PostEffectClasses> = [T, Partial<InstanceProperties<PostEffectClasses[T]>>];

	/**
	 * Lighting properties required for certain game features to function.
	 */
	export type RequiredLightingProperties = "Brightness";

	/**
	 * Describes baked lighting settings which would not be affected by the {@link LightingState}.
	 */
	export interface BakedLightingDescription {
		/**
		 * Description for the Skybox.
		 */
		skyBox: Partial<Sky>;
		/**
		 * Properties to have the Lighting service assigned with.
		 * 
		 * !!! SOME PROPERTIES ARE REQUIRED !!!
		 */
		properties: Required<Pick<InstanceProperties<Lighting>, RequiredLightingProperties>> & Partial<InstanceProperties<Lighting>>;
		/**
		 * Lighting effect descriptions (post-processing, etc.).
		 */
		effects: LightingEffectDescription<keyof PostEffectClasses>[];
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
		/**
		 * Describe how lighting should change over time.
		 */
		updatesState: LightingUpdatesState;
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