/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useContext } from "@rbxts/react";
import { GuiManagerContext } from "CONTACT ONE/shared/players/gui/GuiManagerContext";
import { StackBehavior, StackComponentProps } from "../StackBehavior";

export const EliminatedScreen: React.FC<StackComponentProps<StackBehavior>> = (props: StackComponentProps<StackBehavior>) => {
	const guiManagerContext = useContext(GuiManagerContext);

	assert(guiManagerContext);

	return <textbutton
		Text={"go to menu"}
		Event={{
			Activated: () => props.behavior.tryExit()
		}}
		TextSize={100}
		AutomaticSize={Enum.AutomaticSize.XY}
	/>;
};