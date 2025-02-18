/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { useCallback, useContext, useEffect } from "@rbxts/react";
import { ContextActionService, Workspace } from "@rbxts/services";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { CharacterManager } from "CONTACT ONE/shared/characters/CharacterManager";
import { CharacterPhysics } from "CONTACT ONE/shared/characters/CharacterPhysics";
import { AttackOrder } from "CONTACT ONE/shared/stacks/organization/orders/AttackOrder";
import { BaseOrder } from "CONTACT ONE/shared/stacks/organization/orders/BaseOrder";
import { MoveOrder } from "CONTACT ONE/shared/stacks/organization/orders/MoveOrder";
import { OrderManager } from "CONTACT ONE/shared/stacks/organization/orders/OrderManager";
import { Constructable, dict } from "CORP/shared/Libraries/Utilities";
import { CharacterGuiContext } from "../CharacterGuiContext";
import { OrderMakerContext } from "./OrderMakerContext";

type OrderManifest = [Enum.KeyCode, Constructable<BaseOrder<any>>][];

const POSITION_ORDERS: OrderManifest = [[Enum.KeyCode.M, MoveOrder]];
const CHARACTER_ORDERS: OrderManifest = [[Enum.KeyCode.T, AttackOrder]];
const AVAILABLE_ORDERS = [...POSITION_ORDERS, ...CHARACTER_ORDERS];

const ORDER_INSTANTIATOR_BIND_NAME = "OrderInstantiatorBinds";

function castLookRayForPosition(camera: Camera) {
	const params = new RaycastParams();

	params.CollisionGroup = CharacterPhysics.PHYSICS_GROUP_ORDER_CAST;

	const result = Workspace.Raycast(camera.CFrame.Position, camera.CFrame.LookVector.mul(1024), params);

	return result ? result.Position : camera.CFrame.Position.add(camera.CFrame.LookVector.mul(1024));
}

function castLookRayForRig(char: Character, camera: Camera): Character | undefined {
	const params = new RaycastParams();

	params.FilterDescendantsInstances = [char.rig.getValue()];
	params.FilterType = Enum.RaycastFilterType.Exclude;
	params.CollisionGroup = CharacterPhysics.PHYSICS_GROUP_ORDER_CAST;

	const result = Workspace.Raycast(camera.CFrame.Position, camera.CFrame.LookVector.mul(1024), params);

	if (result) {
		const char = CharacterManager.getCharacterFromInstance(result.Instance);

		return char;
	}
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
	}, [characterContext.character, makerContext]); // Add makerContext to dependencies

	const handleInput = useCallback((actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => {
		if (inputState === Enum.UserInputState.Begin) {
			print("Selected members in handleInput:", makerContext.selectedMembers.size()); // Add debug print

			const associatedOrderInfo = AVAILABLE_ORDERS.find(([keybind]) => inputObject.KeyCode === keybind);

			if (!associatedOrderInfo) {
				warn(`Got a bad input KeyCode: ${inputObject.KeyCode}`);

				return Enum.ContextActionResult.Pass;
			}

			const [, associatedOrder] = associatedOrderInfo;

			const isPositionOrder = POSITION_ORDERS.some(order => order[1] === associatedOrder);
			const isCharacterOrder = CHARACTER_ORDERS.some(order => order[1] === associatedOrder);

			createOrder(associatedOrder, {
				position: isPositionOrder ? castLookRayForPosition(Workspace.CurrentCamera!) : undefined,
				characterId: isCharacterOrder ? castLookRayForRig(characterContext.character, Workspace.CurrentCamera!)?.getId() : undefined
			});
		} else {
			return Enum.ContextActionResult.Pass;
		}
	}, [AVAILABLE_ORDERS, makerContext]); // Add makerContext to dependencies

	useEffect(() => {
		ContextActionService.BindAction(ORDER_INSTANTIATOR_BIND_NAME, handleInput, false, ...AVAILABLE_ORDERS.map(order => order[0]));

		return () => ContextActionService.UnbindAction(ORDER_INSTANTIATOR_BIND_NAME);
	}, [makerContext]);

	return <></>;
};
