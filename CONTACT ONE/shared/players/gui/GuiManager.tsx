import React, { StrictMode, useEffect, useState } from "@rbxts/react";
import ReactRoblox, { createRoot } from "@rbxts/react-roblox";
import { Players } from "@rbxts/services";
import { Constructable } from "CORP/shared/Libraries/Utilities";
import { PlayerBehavior } from "../PlayerBehavior";
import { PlayerState } from "../PlayerState";
import { GameGui } from "./GameGui";
import { GuiManagerContext } from "./GuiManagerContext";
import { LobbyGui } from "./Lobby";
import { Debriefing } from "./debriefing/Debriefing";

export const PlayerStateComponentConstructors = {
	[PlayerState.LOBBY]: LobbyGui,
	[PlayerState.IN_GAME]: GameGui,
	[PlayerState.ELIMINATED]: GameGui,
	[PlayerState.DEBRIEFING]: Debriefing
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

	private readonly rootFolder: Folder;
	private readonly rootInstance: ReactRoblox.Root;

	constructor(playerBehavior: PlayerBehavior) {
		this.playerBehavior = playerBehavior;
		this.rootFolder = new Instance("Folder");

		this.rootFolder.Parent = Players.LocalPlayer.WaitForChild("PlayerGui");
		this.rootFolder.Name = "Root";
		
		this.rootInstance = createRoot(this.rootFolder);
	}

	initialize() {
		this.rootInstance.render(<StrictMode><RootGui guiManager={this} /></StrictMode>);
	}
}