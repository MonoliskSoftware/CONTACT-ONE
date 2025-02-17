import React, { useContext, useState } from "@rbxts/react";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { CharacterGuiContext } from "../CharacterGuiContext";
import { MemberSelector } from "./MemberSelector";
import { OrderInstantiator } from "./OrderInstantiator";
import { OrderMakerContext } from "./OrderMakerContext";

export const OrderMaker: React.FC = () => {
	const battleContext = useContext(CharacterGuiContext);

	assert(battleContext);

	const [selectedMembers, setSelectedMembers] = useState<Character[]>([]);

	return <OrderMakerContext.Provider value={{
		selectedMembers,
		setSelectedMembers
	}}>
		<MemberSelector />
		<OrderInstantiator />
	</OrderMakerContext.Provider>;
};