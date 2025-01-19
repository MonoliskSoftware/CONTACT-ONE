import React, { useContext, useEffect, useState } from "@rbxts/react";
import { GuiManagerContext } from "./GuiManagerContext";

export const GameGui: React.FC = () => {
	const guiManagerContext = useContext(GuiManagerContext);

	assert(guiManagerContext);

	const [currentStackBehavior, setCurrentStackBehavior] = useState(guiManagerContext.playerBehavior.getCurrentStackBehavior());

	useEffect(() => {
		const conn = guiManagerContext.playerBehavior.stack.onValueChanged.connect(stack => setCurrentStackBehavior(guiManagerContext.playerBehavior.getCurrentStackBehavior()));

		return () => conn.disconnect();
	});

	const StackComponent = currentStackBehavior.guiComponent;

	return (
		<>
			{<StackComponent behavior={currentStackBehavior} />}
		</>
	);
};