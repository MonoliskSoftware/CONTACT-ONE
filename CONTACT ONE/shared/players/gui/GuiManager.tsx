import React, { StrictMode, useEffect, useState } from "@rbxts/react";
import { createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { Constructable } from "CORP/shared/Libraries/Utilities";
import { PlayerBehavior } from "../PlayerBehavior";
import { PlayerState } from "../PlayerState";
import { GameGui } from "./GameGui";
import { GuiManagerContext } from "./GuiManagerContext";
import { LobbyGui } from "./Lobby";

export const PlayerStateComponentConstructors = {
	[PlayerState.LOBBY]: LobbyGui,
	[PlayerState.IN_GAME]: GameGui
} as { [key in PlayerState]: Constructable<React.Component> | React.FC };

const RootGui = ({ guiManager }: { guiManager: GuiManager }): React.ReactNode => {
	const [currentPlayerState, setPlayerState] = useState(guiManager.playerBehavior.state.getValue());

	useEffect(() => {
		// Subscribe to changes
		const connection = guiManager.playerBehavior.state.onValueChanged.connect(state => setPlayerState(state));

		return () => connection.disconnect();
	}, [guiManager]);

	const CurrentComponent = PlayerStateComponentConstructors[currentPlayerState];

	return (
		<>
			<GuiManagerContext.Provider value={{ guiManager, playerBehavior: guiManager.playerBehavior }}>
				<CurrentComponent />
			</GuiManagerContext.Provider >
		</>
	);
};

export class GuiManager {
	readonly playerBehavior: PlayerBehavior;

	private readonly rootInstance = createRoot(Players.LocalPlayer.WaitForChild("PlayerGui"));

	constructor(playerBehavior: PlayerBehavior) {
		this.playerBehavior = playerBehavior;
	}

	initialize() {
		this.rootInstance.render(<StrictMode><RootGui guiManager={this} /></StrictMode>);
	}
}