import React, { useContext, useEffect, useState } from "@rbxts/react";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { CharacterGuiContext } from "../CharacterGuiContext";
import { OrderMakerContext } from "./OrderMakerContext";

const MemberOption: React.FC<{
	character: Character,
	index: number
}> = (props) => {
	const makerContext = useContext(OrderMakerContext);

	assert(makerContext);

	return <imagebutton
		Event={{
			Activated: () => {
				const selected = makerContext.selectedMembers.includes(props.character);

				if (selected) {
					makerContext.setSelectedMembers(makerContext.selectedMembers.filter(member => member !== props.character));
				} else {
					makerContext.setSelectedMembers([...makerContext.selectedMembers, props.character]);
				}
			}
		}}
		Size={UDim2.fromOffset(64, 64)}
	>

	</imagebutton>;
};

export const MemberSelector: React.FC = () => {
	const characterContext = useContext(CharacterGuiContext);

	assert(characterContext);

	const makerContext = useContext(OrderMakerContext);

	assert(makerContext);

	const [availableMembers, setAvailableMembers] = useState<Character[]>(characterContext.unit.directMembers);

	useEffect(() => {
		const connections = [
			characterContext.unit.memberAdded.connect(() => setAvailableMembers(characterContext.unit.directMembers)),
			characterContext.unit.memberRemoved.connect(() => setAvailableMembers(characterContext.unit.directMembers)),
		];

		return () => connections.forEach(conn => conn.disconnect());
	});

	useEffect(() => {
		setAvailableMembers(characterContext.unit.directMembers);
	}, [characterContext.unit]);

	useEffect(() => {
		makerContext.setSelectedMembers(makerContext.selectedMembers.filter(member => availableMembers.includes(member)));
	}, [availableMembers]);

	return <screengui
		
	>
		{availableMembers.map((member, index) => <MemberOption character={member} index={index} />)}
	</screengui>;
};