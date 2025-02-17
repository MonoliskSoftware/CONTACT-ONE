import { createContext } from "@rbxts/react";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { PlayerController } from "CONTACT ONE/shared/players/PlayerBehavior";

export interface BattleStackContextType {
	playerController: PlayerController,
	character: Character
}

export const BattleStackContext = createContext<BattleStackContextType | undefined>(undefined);