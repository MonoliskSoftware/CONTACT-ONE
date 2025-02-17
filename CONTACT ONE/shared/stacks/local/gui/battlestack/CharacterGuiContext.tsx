/* eslint-disable @typescript-eslint/no-explicit-any */
import { createContext } from "@rbxts/react";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { Unit } from "CONTACT ONE/shared/stacks/organization/elements/Unit";

export interface CharacterGuiContextType {
	character: Character,
	unit: Unit<any, any>
}

export const CharacterGuiContext = createContext<CharacterGuiContextType | undefined>(undefined);