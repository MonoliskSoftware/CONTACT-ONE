import { createContext } from "@rbxts/react";
import { PlayerBehavior } from "../PlayerBehavior";
import { GuiManager } from "./GuiManager";

export interface GuiManagerContextType {
	guiManager: GuiManager,
	playerBehavior: PlayerBehavior
}

export const GuiManagerContext = createContext<GuiManagerContextType | undefined>(undefined);