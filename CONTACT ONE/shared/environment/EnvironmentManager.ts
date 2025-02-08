import Object from "@rbxts/object-utils";
import { Lighting, RunService, Workspace } from "@rbxts/services";
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { Serializable } from "../Scripts/Serialization/Serializable";
import { EnvironmentDescriptions } from "./EnvironmentDescriptions";

const k: EnvironmentDescriptions.LightingEffectDescription<"ColorCorrectionEffect"> = ["ColorCorrectionEffect", {

}];

const DefaultBakedLighting = {
	skyBox: {
		SkyboxBk: "rbxassetid://6444884337",
		SkyboxDn: "rbxassetid://6444884785",
		SkyboxFt: "rbxassetid://6444884337",
		SkyboxLf: "rbxassetid://6444884337",
		SkyboxRt: "rbxassetid://6444884337",
		SkyboxUp: "rbxassetid://6412503613",
		SunTextureId: "rbxassetid://6196665106",
		MoonTextureId: "rbxassetid://6444320592",
		SunAngularSize: 11
	},
	effects: [
		["ColorCorrectionEffect", {
			Brightness: 0.1,
			Saturation: -0.3,
			Contrast: 0.3
		} as Partial<InstanceProperties<ColorCorrectionEffect>>],
		["BloomEffect", {
			Enabled: true,
			Intensity: 1,
			Size: 24,
			Threshold: 1.5
		} as Partial<InstanceProperties<BloomEffect>>],
		["SunRaysEffect", {
			Intensity: 0.15,
			Spread: 1
		} as Partial<InstanceProperties<SunRaysEffect>>]
	],
	properties: {
		Brightness: 10,
		Ambient: new Color3(0, 0, 0),
		OutdoorAmbient: Color3.fromRGB(40, 40, 40)
	}
} satisfies EnvironmentDescriptions.BakedLightingDescription;

export const DefaultLightingUpdatesState = {
	timeDoesProgress: true,
	dayLength: 1440
} satisfies EnvironmentDescriptions.LightingUpdatesState;

export const DefaultLightingState = {
	timeOfDay: 12,
	cloudiness: 0.5,
	updatesState: DefaultLightingUpdatesState
} satisfies EnvironmentDescriptions.LightingState;

/**
 * Manages enviroment/visual aspects, such as lighting and audio.
 */
export class EnvironmentManager extends NetworkBehavior {
	private static singleton: EnvironmentManager;
	private static readonly environmentUpdateRenderBinding = "EnvironmentManagerRenderingUpdate";

	@Serializable
	private bakedLighting: EnvironmentDescriptions.BakedLightingDescription = DefaultBakedLighting;

	private lightingState = new NetworkVariable<EnvironmentDescriptions.LightingState>(this, DefaultLightingState);
	private overridenProperties = new Map<keyof Partial<Lighting>, boolean>();

	private clouds?: Clouds;
	private sky?: Sky;
	private atmosphere?: Atmosphere;

	// Computed values
	private timeProgressionPerSecond = 1;
	private currentTimeBasis = 0;

	// --------------
	//	COMPUTATIONS
	// --------------
	/**
	 * Updates the time progression factor to match the current lighting update state settings.
	 */
	private computeLightingUpdatesData(): void {
		const lightingUpdatesState = this.lightingState.getValue().updatesState;

		this.timeProgressionPerSecond = 24 / lightingUpdatesState.dayLength;
	}

	/**
	 * Calculates the intended value of the Haze property for the Atmosphere.
	 * 
	 * @param x Cloudiness
	 * @returns Haze
	 */
	private computeHazeFactor(x: number): number {
		return 15 * (math.max(x - 0.75, 0) ** 2);
	}

	// ----------
	//	APPLYING
	// ----------
	/**
	 * Applies all of the base lighting settings.
	 */
	private applyBakedLighting(): void {
		Object.assign(Lighting, this.bakedLighting.properties);
	}

	/**
	 * Used to apply changes to the state, such as time of day, instantly.
	 */
	private applyInstantaneousLightingState(): void {
		this.currentTimeBasis = tick();

		this.applyProperties({
			ClockTime: this.lightingState.getValue().timeOfDay
		});

		this.computeLightingUpdatesData();
		this.applyTimeAndWeather();
	}

	/**
	 * Updates the ClockTime based off of time progression.
	 */
	private applyTimeProgression(): void {
		const lightingState = this.lightingState.getValue();

		this.applyProperties({
			ClockTime: (lightingState.timeOfDay + ((tick() - this.currentTimeBasis) * this.timeProgressionPerSecond)) % 24
		});
	}

	/**
	 * Applies effects based off of lighting state.
	 */
	private applyTimeAndWeather() {
		const lightingState = this.lightingState.getValue();

		this.applyProperties({
			ShadowSoftness: lightingState.cloudiness,
			Brightness: this.getAppliedBrightness() * (1 - lightingState.cloudiness),
			EnvironmentDiffuseScale: this.getIsNightTime() ? 0 : ((1 - math.abs(Lighting.ClockTime - 12) / 12) - this.lightingState.getValue().cloudiness * 0.5)
		});

		// Appply individual effects
		if (this.clouds)
			this.clouds.Cover = lightingState.cloudiness;

		if (this.atmosphere)
			this.atmosphere.Haze = this.computeHazeFactor(lightingState.cloudiness) * 3;
	}

	/**
	 * Applies the properties to the Lighting service.
	 */
	private applyProperties(properties: Partial<Lighting>): void {
		Object.assign(Lighting, Object.fromEntries(Object.entries(properties).filter(([key]) => !this.overridenProperties.get(key))));
	}

	// -----------------
	//	INITIALIZATIONS
	// -----------------
	/**
	 * Initializes effects used for weather.
	 * 
	 * @returns Clouds effect
	 */
	private initializeWeather(): Clouds {
		const clouds = new Instance("Clouds");

		clouds.Parent = Workspace.Terrain;

		return clouds;
	}

	/**
	 * Initializes Sky effects.
	 * 
	 * @returns Sky
	 */
	private initializeSky(): Sky {
		const sky = new Instance("Sky");

		Object.assign(sky, this.bakedLighting.skyBox);

		sky.Parent = Lighting;

		return sky;
	}

	/**
	 * Initializes Atmosphere effects.
	 * 
	 * @returns Atmosphere
	 */
	private initializeAtmosphere(): Atmosphere {
		const atmosphere = new Instance("Atmosphere");

		atmosphere.Decay = Color3.fromRGB(106, 112, 125);
		atmosphere.Color = Color3.fromRGB(199, 199, 199);

		atmosphere.Parent = Lighting;

		return atmosphere;
	}

	/**
	 * Initializes effects described in the baked lighting description.
	 */
	private initializeBakedEffects(): void {
		this.bakedLighting.effects.forEach(([clazz, props]) => {
			const effect = new Instance(clazz);

			Object.assign(effect, props);

			effect.Parent = Lighting;
		});
	}

	private onRenderStep(deltaTime: number): void {
		const lightingState = this.lightingState.getValue();
		const lightingUpdatesState = lightingState.updatesState;

		// eslint-disable-next-line roblox-ts/lua-truthiness
		if (lightingUpdatesState.timeDoesProgress) {
			this.applyTimeProgression();
		}

		this.applyTimeAndWeather();
	}

	private getIsNightTime(): boolean {
		return math.abs(Lighting.ClockTime - 12) > 6;
	}

	private getAppliedBrightness(): number {
		return this.getIsNightTime() ? 0 : this.bakedLighting.properties.Brightness;
	}

	public getTotalBaseSaturation(): number {
		return this.bakedLighting?.effects.reduce((total, current) => total + ((current[1] as Partial<ColorCorrectionEffect>).Saturation ?? 0), 0) ?? 0;
	}

	public onStart(): void {
		if (RunService.IsClient()) {
			this.applyBakedLighting();
			this.applyInstantaneousLightingState(); // Updates ClockTime to match the value set in the current state

			this.lightingState.onValueChanged.connect(state => this.applyInstantaneousLightingState());

			RunService.BindToRenderStep(EnvironmentManager.environmentUpdateRenderBinding, Enum.RenderPriority.Camera.Value, deltaTime => this.onRenderStep(deltaTime));
		}
	}

	public willRemove(): void {
		if (RunService.IsClient())
			RunService.UnbindFromRenderStep(EnvironmentManager.environmentUpdateRenderBinding);
	}

	constructor(gameObject: GameObject) {
		super(gameObject);

		EnvironmentManager.singleton = this;

		if (RunService.IsClient()) {
			Lighting.ClearAllChildren();
			
			this.clouds = this.initializeWeather();
			this.sky = this.initializeSky();
			this.atmosphere = this.initializeAtmosphere();

			this.initializeBakedEffects();
		}
	}

	/**
	 * Marks a set of properties as overriden or "in use" by other scripts. These properties will not be modified by Environment code.
	 * 
	 * @param overridenProperties Map of property names and whether or not it is overriden
	 */
	public setOverridenProperties(overridenProperties: Map<keyof Partial<Lighting>, boolean>): void {
		overridenProperties.forEach((value, key) => this.overridenProperties.set(key, value));
	}

	/**
	 * @returns Current singleton EnvironmentManager.
	 */
	public static getSingleton(): EnvironmentManager {
		return EnvironmentManager.singleton;
	}

	protected getSourceScript(): ModuleScript {
		return script as ModuleScript;
	}
}