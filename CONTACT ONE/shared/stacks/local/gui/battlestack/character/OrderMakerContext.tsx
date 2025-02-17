import { createContext, SetStateAction } from "@rbxts/react";
import { Character } from "CONTACT ONE/shared/characters/Character";

export interface OrderMakerContextType {
	setSelectedMembers: (members: SetStateAction<Character[]>) => void,
	selectedMembers: Character[],
}

export const OrderMakerContext = createContext<OrderMakerContextType | undefined>(undefined);