import Object from "@rbxts/object-utils";
import { VRService, Workspace } from "@rbxts/services";
import { FlagUtil } from "../FlagUtil";
import { CameraUtils } from "./CameraUtils";


const FFlagUserHideCharacterParticlesInFirstPerson = FlagUtil.getUserFlag("UserHideCharacterParticlesInFirstPerson");

const MAX_TWEEN_RATE = 2.8; // per second

// Classes with a LocalTransparencyModifier property that we should hide in first person
const HIDE_IN_FIRST_PERSON_CLASSES = [
	"BasePart",
	"Decal",
	"Beam",
	"ParticleEmitter",
	"Trail",
	"Fire",
	"Smoke",
	"Sparkles",
	"Explosion"
];

/**
 * TransparencyController - Manages transparency of player character at close camera-to-subject distances
 * 2018 Camera Update - AllYourBlox
 */
export class TransparencyController {
	transparencyDirty = false;
	enabled = false;
	lastTransparency: number | undefined;

	descendantAddedConn: RBXScriptConnection | undefined;
	descendantRemovingConn: RBXScriptConnection | undefined;
	toolDescendantAddedConns = new Map<Tool, RBXScriptConnection>();
	toolDescendantRemovingConns = new Map<Tool, RBXScriptConnection>();
	cachedParts = new Map<BasePart, boolean>();

	Update(dt: number) {
		const currentCamera = Workspace.CurrentCamera;

		if (currentCamera && this.enabled) {
			// calculate goal transparency based on distance
			const distance = (currentCamera.Focus.Position.sub(currentCamera.CFrame.Position)).Magnitude;
			let transparency = distance < 2 ? 1 - (distance - 0.5) / 1.5 : 0; // (7 - distance) / 5

			if (transparency < 0.5) transparency = 0; // too far, don't control transparency

			// tween transparency if the goal is not fully transparent and the subject was not fully transparent last frame
			if (this.lastTransparency !== undefined && transparency < 1 && this.lastTransparency < 0.95) {
				let deltaTransparency = transparency - this.lastTransparency;
				const maxDelta = MAX_TWEEN_RATE * dt;
				deltaTransparency = math.clamp(deltaTransparency, -maxDelta, maxDelta);
				transparency = this.lastTransparency + deltaTransparency;
			} else {
				this.transparencyDirty = true;
			}

			transparency = math.clamp(CameraUtils.Round(transparency, 2), 0, 1);

			// update transparencies
			if (this.transparencyDirty || this.lastTransparency !== transparency) {
				this.cachedParts.forEach((_, child) => {
					if (VRService.VREnabled && VRService.AvatarGestures) {
						// keep the arms visible in VR
						const hiddenAccessories = new Map<Enum.AccessoryType, boolean>([
							[Enum.AccessoryType.Hat, true],
							[Enum.AccessoryType.Hair, true],
							[Enum.AccessoryType.Face, true],
							[Enum.AccessoryType.Eyebrow, true],
							[Enum.AccessoryType.Eyelash, true]
						]);

						if (child.Parent?.IsA("Accessory") && hiddenAccessories.get(child.Parent.AccessoryType)) {
							child.LocalTransparencyModifier = transparency;
						} else {
							// body should always be visible in VR
							child.LocalTransparencyModifier = 0;
						}
					} else {
						child.LocalTransparencyModifier = transparency;
					}

					this.transparencyDirty = false;
					this.lastTransparency = transparency;
				});
			}
		}
	}

	SetSubject(subject: BasePart | Humanoid | undefined) {
		let character = undefined;

		if (subject && subject.IsA("Humanoid")) character = subject.Parent;
		if (subject && subject.IsA("VehicleSeat") && subject.Occupant) character = subject.Occupant.Parent;
		if (character) {
			this.SetupTransparency(character);
		} else {
			this.TeardownTransparency();
		}
	}

	TeardownTransparency() {
		Object.keys(this.cachedParts).forEach(child => child.LocalTransparencyModifier = 0);

		this.cachedParts.clear();
		this.transparencyDirty = true;
		this.lastTransparency = undefined;

		this.descendantAddedConn?.Disconnect();
		this.descendantAddedConn = undefined;

		this.descendantRemovingConn?.Disconnect();
		this.descendantRemovingConn = undefined;

		this.toolDescendantAddedConns.forEach((conn, object) => {
			conn.Disconnect();
			this.toolDescendantAddedConns.delete(object);
		});

		this.toolDescendantRemovingConns.forEach((conn, object) => {
			conn.Disconnect();
			this.toolDescendantRemovingConns.delete(object);
		});
	}

	HasToolAncestor(object: Instance): boolean {
		if (object.Parent === undefined) return false;

		assert(object.Parent);

		return object.Parent.IsA("Tool") || this.HasToolAncestor(object.Parent);
	}

	IsValidPartToModify(part: Instance): part is BasePart {
		if (FFlagUserHideCharacterParticlesInFirstPerson) {
			return HIDE_IN_FIRST_PERSON_CLASSES.some(className => part.IsA(className as keyof Instances)) && !this.HasToolAncestor(part);
		} else {
			return part.IsA("BasePart") && part.IsA("Decal") && !this.HasToolAncestor(part);
		}
	}

	SetupTransparency(character: Instance) {
		this.TeardownTransparency();

		this.descendantAddedConn?.Disconnect();
		
		this.descendantAddedConn = character.DescendantAdded.Connect((object) => {
			// This is a part we want to invisify
			if (this.IsValidPartToModify(object)) {
				this.cachedParts.set(object, true);
				this.transparencyDirty = true;
			} else if (object.IsA("Tool")) {
				this.toolDescendantAddedConns.get(object)?.Disconnect();

				this.toolDescendantAddedConns.set(object, object.DescendantAdded.Connect((toolChild) => {
					this.cachedParts.delete(toolChild as BasePart);

					if (toolChild.IsA("BasePart") || toolChild.IsA("Decal")) {
						// Reset the transparency
						toolChild.LocalTransparencyModifier = 0;
					}
				}));

				this.toolDescendantRemovingConns.get(object)?.Disconnect();

				this.toolDescendantRemovingConns.set(object, object.DescendantRemoving.Connect((formerToolChild) => {
					task.wait(); // wait for new parent
					if (character && formerToolChild && formerToolChild.IsDescendantOf(character) && this.IsValidPartToModify(formerToolChild)) {
						this.cachedParts.set(formerToolChild as BasePart, true);
						this.transparencyDirty = true;
					}
				}));
			}
		});

		this.descendantRemovingConn?.Disconnect();

		this.descendantRemovingConn = character.DescendantRemoving.Connect((object) => {
			if (this.cachedParts.has(object as BasePart)) {
				this.cachedParts.delete(object as BasePart);
				// Reset the transparency
				(object as BasePart).LocalTransparencyModifier = 0;
			}
		});

		this.CachePartsRecursive(character);
	}

	CachePartsRecursive(object: Instance) {
		if (object) {
			if (this.IsValidPartToModify(object)) {
				this.cachedParts.set(object, true);
				this.transparencyDirty = true;
			}

			object.GetChildren().forEach(child => this.CachePartsRecursive(child));
		}
	} 

	Enable(enable: boolean) {
		if (this.enabled !== enable) {
			this.enabled = enable;
		}
	}
}