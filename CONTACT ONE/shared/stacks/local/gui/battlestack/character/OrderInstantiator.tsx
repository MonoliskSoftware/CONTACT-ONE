/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useContext, useEffect } from "@rbxts/react";
import { ContextActionService, Workspace } from "@rbxts/services";
import { BaseOrder } from "CONTACT ONE/shared/stacks/organization/orders/BaseOrder";
import { MoveOrder } from "CONTACT ONE/shared/stacks/organization/orders/MoveOrder";
import { OrderManager } from "CONTACT ONE/shared/stacks/organization/orders/OrderManager";
import { Constructable, dict } from "CORP/shared/Libraries/Utilities";
import { CharacterGuiContext } from "../CharacterGuiContext";
import { OrderMakerContext } from "./OrderMakerContext";

const AVAILABLE_ORDERS: [Enum.KeyCode, Constructable<BaseOrder<any>>][] = [[Enum.KeyCode.M, MoveOrder]];
const ORDER_INSTANTIATOR_BIND_NAME = "OrderInstantiatorBinds";

function castLookRay(camera: Camera) {
	const result = Workspace.Raycast(camera.CFrame.Position, camera.CFrame.LookVector.mul(1024));

	return result ? result.Position : camera.CFrame.Position.add(camera.CFrame.LookVector.mul(1024));
}

export const OrderInstantiator: React.FC = (props) => {
	const makerContext = useContext(OrderMakerContext);

	assert(makerContext);

	const characterContext = useContext(CharacterGuiContext);

	assert(characterContext);

	const createOrder = useCallback((orderClass: Constructable<BaseOrder<any>>, parameters: dict) => {
		const order = OrderManager.singleton.createOrder(orderClass, characterContext.character, parameters);
		
		order.trySetAssignedActors(makerContext.selectedMembers.map(member => member.getId()));
		order.tryExecute();
	}, [characterContext.character]);

	const handleInput = useCallback((actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => {
		if (inputState === Enum.UserInputState.Begin) {
			const associatedOrder = AVAILABLE_ORDERS.find(([keybind]) => inputObject.KeyCode === keybind);

			if (!associatedOrder) {
				warn(`Got a bad input KeyCode: ${inputObject.KeyCode}`);
	
				return Enum.ContextActionResult.Pass;
			}
	
			createOrder(associatedOrder[1], { 
				position: castLookRay(Workspace.CurrentCamera!)
			});
		} else {
			return Enum.ContextActionResult.Pass;
		}
	}, [AVAILABLE_ORDERS]);

	useEffect(() => {
		ContextActionService.BindAction(ORDER_INSTANTIATOR_BIND_NAME, handleInput, false, ...AVAILABLE_ORDERS.map(order => order[0]));
	
		return () => ContextActionService.UnbindAction(ORDER_INSTANTIATOR_BIND_NAME);
	});

	return <></>;
};