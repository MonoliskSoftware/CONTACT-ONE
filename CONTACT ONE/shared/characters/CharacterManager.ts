import { Character, Rig } from "./Character";

export class CharacterManager {
	private static characters: Character[] = [];

	public static onCharacterAdded(character: Character) {
		this.characters.push(character);
	}

	public static onCharacterRemoved(character: Character) {
		this.characters = this.characters.filter(other => other !== character);
	}

	public static getCharacterFromRig(rig: Rig) {
		return this.characters.find(char => char.rig.getValue() === rig);
	}

	public static getCharacterFromInstance(object: Instance) {
		return this.characters.find(char => object.IsDescendantOf(char.rig.getValue()));
	}
}