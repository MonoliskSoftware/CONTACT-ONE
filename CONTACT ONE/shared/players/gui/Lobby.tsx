import React, { useContext, useEffect, useState } from "@rbxts/react";
import { Faction } from "CONTACT ONE/shared/stacks/organization/Faction";
import { PlayerBehavior } from "../PlayerBehavior";
import { FactionSelector } from "./FactionSelector";
import { GuiManagerContext } from "./GuiManagerContext";
import { ORBATViewer } from "./ORBATViewer";
import { LobbyState } from "./lobby/LobbyState";

// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export type LobbyGuiProps = {};

interface LobbyStateData {
	faction: Faction | undefined
}

function switchLobbyPage(state: LobbyState, { faction }: LobbyStateData) {
	switch (state) {
		case LobbyState.SELECTING_FACTION:
			return <FactionSelector.Selector />;
		case LobbyState.SELECTING_UNIT:
			assert(faction);

			return <ORBATViewer.Window faction={faction} />;
	}
}

function evaluateState(state: LobbyStateData, localBehavior: PlayerBehavior): LobbyState {
	if (state.faction && localBehavior.commandedUnits.size() === 0) {
		return LobbyState.SELECTING_UNIT;
	} else if (!state.faction) {
		return LobbyState.SELECTING_FACTION;
	}

	return LobbyState.SELECTING_FACTION;
}

export const LobbyGui: React.FC<LobbyGuiProps> = () => {
	const guiContext = useContext(GuiManagerContext);

	if (!guiContext) throw `LobbyGui must be used in a GuiManagerContext.Provider`;

	const [lobbyState, setLobbyState] = useState<LobbyState>(LobbyState.SELECTING_FACTION);
	const [faction, setFaction] = useState<Faction | undefined>(guiContext.playerBehavior.faction.getValue());

	useEffect(() => {
		// Subscribe to changes
		const factionChangedConn = guiContext.playerBehavior.faction.onValueChanged.connect(newFaction => {
			if (newFaction !== faction) setFaction(newFaction);

			const newState = evaluateState({ faction: newFaction }, guiContext.playerBehavior);

			if (newState !== lobbyState) setLobbyState(newState);
		});

		return () => {
			factionChangedConn.disconnect();
		};
	});

	return (
		<>
			{switchLobbyPage(lobbyState, { faction })}
		</>
	);
};