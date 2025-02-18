import React, { useCallback, useContext, useEffect, useState } from "@rbxts/react";
import { ContextActionService } from "@rbxts/services";
import { Character } from "CONTACT ONE/shared/characters/Character";
import { CharacterGuiContext } from "../CharacterGuiContext";
import { OrderMakerContext } from "./OrderMakerContext";

const MEMBER_KEYBINDS = [
	Enum.KeyCode.One,
	Enum.KeyCode.Two,
	Enum.KeyCode.Three,
	Enum.KeyCode.Four,
	Enum.KeyCode.Five,
	Enum.KeyCode.Six,
	Enum.KeyCode.Seven,
	Enum.KeyCode.Eight,
	Enum.KeyCode.Nine
];

function toggle<T extends defined>(arr: T[], item: T) {
	if (arr.includes(item)) {
		return arr.filter(otherItem => item !== otherItem);
	} else {
		return [...arr, item];
	}
}

const MemberOption: React.FC<{
	character: Character,
	index: number
}> = (props) => {
	const makerContext = useContext(OrderMakerContext);

	assert(makerContext);

	const formFactor = 32;

	const isSelected = makerContext.selectedMembers.includes(props.character);

	return <imagebutton
		Size={UDim2.fromOffset(formFactor * 3, formFactor * 2)}
		Event={{
			Activated: () => {
				makerContext.setSelectedMembers(toggle(makerContext.selectedMembers, props.character));
			}
		}}
	>
		<uilistlayout
			FillDirection={Enum.FillDirection.Vertical}
			HorizontalFlex={Enum.UIFlexAlignment.Fill}
			VerticalFlex={Enum.UIFlexAlignment.Fill}
		/>
		<textlabel
			Text={tostring(props.index)}
			FontFace={Font.fromName("RobotoMono", Enum.FontWeight.Bold)}
			BackgroundColor3={isSelected ? Color3.fromHex("0055ff") : new Color3(0, 0, 0)}
			BorderSizePixel={0}
		>
		</textlabel>
		<frame

		>
		</frame>
	</imagebutton>;
	// return <imagebutton
	// 	Event={{
	// 		Activated: () => {
	// 			makerContext.setSelectedMembers(toggle(makerContext.selectedMembers, props.character));
	// 		}
	// 	}}
	// 	Size={UDim2.fromOffset(64, 64)}
	// >

	// </imagebutton>;
};

const MEMBER_SELECTOR_BIND_NAME = "MemberSelectorBinds";

export const MemberSelector: React.FC = () => {
	const characterContext = useContext(CharacterGuiContext);

	assert(characterContext);

	const makerContext = useContext(OrderMakerContext);

	assert(makerContext);

	const [availableMembers, setAvailableMembers] = useState<Character[]>(characterContext.unit.directMembers);

	const handleInput = useCallback((actionName: string, inputState: Enum.UserInputState, inputObject: InputObject) => {
		if (inputState === Enum.UserInputState.Begin) {
			const index = MEMBER_KEYBINDS.findIndex(keybind => inputObject.KeyCode === keybind);

			if (index === undefined) {
				warn(`Got a bad input KeyCode: ${inputObject.KeyCode}`);

				return Enum.ContextActionResult.Pass;
			}

			const member = availableMembers[index];

			makerContext.setSelectedMembers(toggle(makerContext.selectedMembers, member));
		} else {
			return Enum.ContextActionResult.Pass;
		}
	}, [MEMBER_KEYBINDS, makerContext]);

	useEffect(() => {
		const connections = [
			characterContext.unit.memberAdded.connect(() => setAvailableMembers(characterContext.unit.directMembers)),
			characterContext.unit.memberRemoved.connect(() => setAvailableMembers(characterContext.unit.directMembers)),
		];

		return () => connections.forEach(conn => conn.disconnect());
	}, []);

	useEffect(() => {
		setAvailableMembers(characterContext.unit.directMembers);
	}, [characterContext.unit]);

	useEffect(() => {
		makerContext.setSelectedMembers(makerContext.selectedMembers.filter(member => availableMembers.includes(member)));
	}, [availableMembers]);

	useEffect(() => {
		ContextActionService.BindAction(MEMBER_SELECTOR_BIND_NAME, handleInput, false, ...MEMBER_KEYBINDS);

		return () => ContextActionService.UnbindAction(MEMBER_SELECTOR_BIND_NAME);
	}, [makerContext]);

	return <screengui

	>
		<uilistlayout
			FillDirection={Enum.FillDirection.Horizontal}
			VerticalAlignment={Enum.VerticalAlignment.Bottom}
			Padding={new UDim(0, 16)}
		/>
		<uipadding
			PaddingLeft={new UDim(0, 32)}
			PaddingRight={new UDim(0, 32)}
			PaddingBottom={new UDim(0, 32)}
			PaddingTop={new UDim(0, 32)}
		/>
		{availableMembers.map((member, index) => <MemberOption character={member} index={index} />)}
	</screengui>;
};