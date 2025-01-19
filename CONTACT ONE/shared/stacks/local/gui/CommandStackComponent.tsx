import React, { useContext, useEffect, useState } from "@rbxts/react";
import { GuiManagerContext } from "CONTACT ONE/shared/players/gui/GuiManagerContext";
import { CommandUnit } from "../../organization/elements/CommandUnit";
import { Unit } from "../../organization/elements/Unit";
import { MoveOrder } from "../../organization/orders/MoveOrder";
import { CommandStackBehavior } from "../CommandStackBehavior";
import { StackComponentProps } from "../StackBehavior";

const UnitUnderOrders: React.FC<{
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	unit: Unit<any, any>
}> = ({ unit }) => {
	return (
		<textbutton Text={unit.name.getValue()} AutomaticSize={Enum.AutomaticSize.XY} />
	);
};

export const CommandStackComponent: React.FC<StackComponentProps<CommandStackBehavior>> = (props: StackComponentProps<CommandStackBehavior>) => {
	const guiManagerContext = useContext(GuiManagerContext);

	assert(guiManagerContext);

	const [controlledUnit, setControlledUnit] = useState<CommandUnit | undefined>(guiManagerContext.playerBehavior.commandedUnits[0]);

	useEffect(() => {
		const conn = guiManagerContext.playerBehavior.commandedUnitsChanged.connect(() => setControlledUnit(guiManagerContext.playerBehavior.commandedUnits[0]));

		return () => conn.disconnect();
	});

	print(controlledUnit);

	// const [currentOrder, setCurrentOrder] = useState

	return (
		<screengui>
			<textbutton
				Text={"CREATE MOVE ORDER"}
				Size={UDim2.fromOffset(200, 200)}
				Event={{
					Activated: () => {
						controlledUnit?.createOrder(MoveOrder, {
							position: Vector3.zero
						});
					}
				}}
			/>
			{controlledUnit?.subordinates.map(sub => <UnitUnderOrders unit={sub} />)}
			<uilistlayout />
		</screengui>
	);
};