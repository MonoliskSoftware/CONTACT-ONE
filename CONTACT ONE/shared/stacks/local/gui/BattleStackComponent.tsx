/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useContext, useState } from "@rbxts/react";
import { GuiManagerContext } from "CONTACT ONE/shared/players/gui/GuiManagerContext";
import { BattleStackBehavior } from "../BattleStackBehavior";
import { StackComponentProps } from "../StackBehavior";
import { StackBehaviorState } from "../StackBehaviorState";
import { EliminatedScreen } from "./EliminatedScreen";
import { BattleStackContext } from "./battlestack/BattleStackContext";
import { CharacterGui } from "./battlestack/CharacterGui";

const MainBattleStackComponent: React.FC<StackComponentProps<BattleStackBehavior>> = (props) => {
	return <CharacterGui {...props} />;
};

const BattleStackContent: React.FC<{
	stackProps: StackComponentProps<BattleStackBehavior>,
	state: StackBehaviorState
}> = (props) => {
	switch (props.state) {
		case StackBehaviorState.INITIALIZING:
		case StackBehaviorState.READY:
			return <MainBattleStackComponent {...props.stackProps} />;
		case StackBehaviorState.ELIMINATED:
			return <EliminatedScreen {...props.stackProps} />;
	}
};

export const BattleStackComponent: React.FC<StackComponentProps<BattleStackBehavior>> = (props: StackComponentProps<BattleStackBehavior>) => {
	const guiManagerContext = useContext(GuiManagerContext);

	assert(guiManagerContext);

	const [behaviorState, setBehaviorState] = useState(props.behavior.state.getValue());

	return (
		<BattleStackContext.Provider value={{
			playerController: guiManagerContext.playerBehavior.getBattleController(),
			character: guiManagerContext.playerBehavior.getBattleController().character,
		}}>
			<BattleStackContent stackProps={props} state={behaviorState} />
		</BattleStackContext.Provider>
	);
};