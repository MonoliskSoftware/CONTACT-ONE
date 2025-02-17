import React, { useContext, useEffect, useState } from "@rbxts/react";
import { BattleStackBehavior } from "../../BattleStackBehavior";
import { StackComponentProps } from "../../StackBehavior";
import { BattleStackContext } from "./BattleStackContext";
import { CharacterGuiContext } from "./CharacterGuiContext";
import { OrderMaker } from "./character/OrderMaker";

export const CharacterGui: React.FC<StackComponentProps<BattleStackBehavior>> = (props) => {
	const battleContext = useContext(BattleStackContext);

	assert(battleContext);

	const [unit, setUnit] = useState(battleContext.character.unit.getValue());

	useEffect(() => {
		const currentUnit = battleContext.character.unit.getValue();

		if (currentUnit !== unit) setUnit(currentUnit);

		const connection = battleContext.character.unit.onValueChanged.connect(setUnit);

		return () => connection.disconnect();
	}, [battleContext.character]);

	return <CharacterGuiContext.Provider value={{
		character: battleContext.character,
		unit: unit
	}}>
		<OrderMaker />
	</CharacterGuiContext.Provider>;
};