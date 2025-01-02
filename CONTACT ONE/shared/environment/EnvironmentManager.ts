import Object from "@rbxts/object-utils";
import { Lighting, RunService, Workspace } from "@rbxts/services";
import { GameObject } from "CORP/shared/Scripts/Componentization/GameObject";
import { NetworkBehavior } from "../Scripts/Networking/NetworkBehavior";
import { NetworkVariable } from "../Scripts/Networking/NetworkVariable";
import { Serializable } from "../Scripts/Serialization/Serializable";
import { EnvironmentDescriptions } from "./EnvironmentDescriptions";

const DefaultBakedLighting = {
	ambient: Color3.fromRGB(50, 50, 50),
	specularScale: 0.25,
	brightness: 3,
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
		} as Partial<ColorCorrectionEffect>],
		["BloomEffect", {
			Enabled: true,
			Intensity: 1,
			Size: 24,
			Threshold: 2
		} as Partial<BloomEffect>]
	]
} satisfies EnvironmentDescriptions.BakedLightingDescription;

export const DefaultLightingState = {
	timeOfDay: 12,
	cloudiness: 0.5
} satisfies EnvironmentDescriptions.LightingState;

export const DefaultLightingUpdatesState = {
	timeDoesProgress: true,
	dayLength: 1440
} satisfies EnvironmentDescriptions.LightingUpdatesState;

/**
 * Applies the properties defined in the partial to the object provided.
 */
function applyPartial<T>(partial: Partial<T>, object: T) {
	Object.entries(partial).forEach(([key, value]) => (object as Writable<T> as { [key: string]: defined })[key as string] = value as defined);
}

export class EnvironmentManager extends NetworkBehavior {
	private static singleton: EnvironmentManager;
	private static readonly environmentUpdateRenderBinding = "EnvironmentManagerRenderingUpdate";

	@Serializable
	private bakedLighting: EnvironmentDescriptions.BakedLightingDescription = DefaultBakedLighting;

	private lightingState = new NetworkVariable<EnvironmentDescriptions.LightingState>(this, DefaultLightingState);
	private lightingUpdatesState = new NetworkVariable<EnvironmentDescriptions.LightingUpdatesState>(this, DefaultLightingUpdatesState);
	private overridenProperties = new Map<keyof Partial<Lighting>, boolean>();

	private clouds?: Clouds;
	private sky?: Sky;
	private atmosphere?: Atmosphere;

	// Computed values
	private timeProgressionPerSecond = 1;
	private currentTimeBasis = 0;

	/**
	 * Applies all of the base lighting settings.
	 */
	private applyGlobalLighting(): void {
		Lighting.Ambient = new Color3(0, 0, 0);
		Lighting.OutdoorAmbient = new Color3(0, 0, 0);
	}

	private computeLightingUpdatesData(): void {
		this.timeProgressionPerSecond = 24 / this.lightingUpdatesState.getValue().dayLength;
	}

	private applyLightingState(): void {
		this.currentTimeBasis = tick();

		this.applyProperties({
			ClockTime: this.lightingState.getValue().timeOfDay
		});

		this.applyClockTime();
	}

	private initializeWeather(): Clouds {
		const clouds = new Instance("Clouds");

		clouds.Parent = Workspace.Terrain;

		return clouds;
	}

	private initializeSky(): Sky {
		const sky = new Instance("Sky");

		applyPartial(this.bakedLighting.skyBox, sky);

		sky.Parent = Lighting;

		return sky;
	}

	private initializeAtmosphere(): Atmosphere {
		const atmosphere = new Instance("Atmosphere");

		atmosphere.Decay = Color3.fromRGB(106, 112, 125);
		atmosphere.Color = Color3.fromRGB(199, 199, 199);

		atmosphere.Parent = Lighting;

		return atmosphere;
	}

	private onRenderStep(deltaTime: number): void {
		const lightingUpdatesState = this.lightingUpdatesState.getValue();
		const lightingState = this.lightingState.getValue();

		if (lightingUpdatesState.timeDoesProgress) {
			this.applyProperties({
				ClockTime: (lightingState.timeOfDay + ((tick() - this.currentTimeBasis) * this.timeProgressionPerSecond)) % 24
			});

			this.applyClockTime();
		}

		this.lightingState.getValue().cloudiness = (math.sin(tick() / 10) + 1) / 2;

		this.applyWeather();
	}

	private getIsNightTime(): boolean {
		return math.abs(Lighting.ClockTime - 12) > 6;
	}

	private getAppliedBrightness(): number {
		return this.getIsNightTime() ? 0 : this.bakedLighting.brightness;
	}

	private applyClockTime(): void {
		this.applyProperties({
			EnvironmentDiffuseScale: this.getIsNightTime() ? 0 : ((1 - math.abs(Lighting.ClockTime - 12) / 12) - this.lightingState.getValue().cloudiness * 0.5)
		});
	}

	private initializeEffects(): void {
		this.bakedLighting.effects.forEach(([clazz, props]) => {
			const effect = new Instance(clazz);

			applyPartial(props, effect);

			effect.Parent = Lighting;
		});
	}

	/**
	 * 
	 * @param x Cloudiness
	 * @returns 
	 */
	private computeHazeFactor(x: number): number {
		return 15 * (math.max(x - 0.75, 0) ** 2);
	}

	private applyWeather(): void {
		const lightingState = this.lightingState.getValue();

		this.applyProperties({
			ShadowSoftness: lightingState.cloudiness,
			Brightness: this.getAppliedBrightness() * (1 - lightingState.cloudiness)
		});

		if (this.clouds)
			this.clouds.Cover = lightingState.cloudiness;

		if (this.atmosphere)
			this.atmosphere.Haze = this.computeHazeFactor(lightingState.cloudiness) * 3;
	}

	private applyProperties(properties: Partial<Lighting>): void {
		Object.entries(properties).filter(([key]) => !this.overridenProperties.get(key)).forEach(([key, value]) => (Lighting as Writable<Lighting> as { [key: string]: defined })[key] = value);
	}

	private getTotalBaseSaturation(): number {
		return this.bakedLighting?.effects.reduce((total, current) => total + ((current[1] as Partial<ColorCorrectionEffect>).Saturation ?? 0), 0) ?? 0;
	}

	public onStart(): void {
		if (RunService.IsClient()) {
			this.applyLightingState();
			this.applyGlobalLighting();
			this.computeLightingUpdatesData();

			this.lightingUpdatesState.onValueChanged.connect(state => this.computeLightingUpdatesData());
			this.lightingState.onValueChanged.connect(state => this.applyLightingState());

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
			this.clouds = this.initializeWeather();
			this.sky = this.initializeSky();
			this.atmosphere = this.initializeAtmosphere();

			this.initializeEffects();
		}
	}

	/**
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