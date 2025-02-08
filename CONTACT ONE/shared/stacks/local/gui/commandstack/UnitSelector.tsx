/* eslint-disable @typescript-eslint/no-explicit-any */
import React, { SetStateAction, useState } from "@rbxts/react";
import { DefaultImageButtonStyle } from "CONTACT ONE/shared/players/gui/style/StyleButton";
import { DefaultFrameStyle } from "CONTACT ONE/shared/players/gui/style/StyleFrame";
import { DefaultTextLabelChildren, StyleTextLabel } from "CONTACT ONE/shared/players/gui/style/StyleLabel";
import { StyleWindow } from "CONTACT ONE/shared/players/gui/style/StyleWindow";
import { Unit } from "CONTACT ONE/shared/stacks/organization/elements/Unit";

const MAX_UNIT_WIDTH = 400;
const UNIT_CARD_HEIGHT = 96;

const UnitCard: React.FC<{
	unit: Unit<any, any>
}> = ({ unit }) => {
	return <imagebutton
		{...DefaultImageButtonStyle}
		{...DefaultFrameStyle}
		Size={UDim2.fromOffset(0, UNIT_CARD_HEIGHT)}
	>
		<uistroke
			Color={Color3.fromRGB(35, 35, 35)}
			ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			Thickness={2}
		/>
		<uipadding
			PaddingLeft={new UDim(0, 8)}
			PaddingRight={new UDim(0, 8)}
			PaddingBottom={new UDim(0, 8)}
			PaddingTop={new UDim(0, 8)}
		/>
		<uicorner
			CornerRadius={new UDim(0, 8)}
		/>
		<uilistlayout
			FillDirection={Enum.FillDirection.Horizontal}
			Padding={new UDim(0, 16)}
			VerticalFlex={Enum.UIFlexAlignment.Fill}
		/>
		<imagelabel
			BorderSizePixel={0}
			Image={unit.classProfile.getValue().iconId}
			BackgroundTransparency={1}
		>
			<uiaspectratioconstraint
				AspectRatio={1.5}
				AspectType={Enum.AspectType.ScaleWithParentSize}
				DominantAxis={Enum.DominantAxis.Width}
			/>
			{DefaultTextLabelChildren}
		</imagelabel>
		<frame
			BackgroundTransparency={1}
		>
			<StyleTextLabel
				Text={unit.name.getValue()}
				TextSize={28}
			/>
			<StyleTextLabel
				Text={`<b>Personnel</b>: ${unit.directMembers.size()}`}
				TextSize={28}
			/>
			<uilistlayout
				VerticalFlex={Enum.UIFlexAlignment.SpaceEvenly}
				Padding={new UDim(0, 16)}
			/>
			<uiflexitem
				FlexMode={Enum.UIFlexMode.Grow}
			/>
		</frame>
	</imagebutton >;
};

const UnitSubordinateExpander: React.FC<{
	expanded: boolean,
	enabled: boolean,
	setExpanded: (isExpanded: SetStateAction<boolean>) => void
}> = ({ enabled, expanded, setExpanded }) => {
	return <imagebutton
		{...DefaultImageButtonStyle}
		{...DefaultFrameStyle}
		Size={UDim2.fromOffset(0, 32)}
		Event={{
			Activated: () => setExpanded(!expanded)
		}}
		Visible={enabled}
	>
		<StyleTextLabel
			Text={expanded ? "▲" : "▼"}
			Position={UDim2.fromScale(0.5, 0.5)}
			AnchorPoint={new Vector2(0.5, 0.5)}
			TextSize={28}
		/>
		<uistroke
			Color={Color3.fromRGB(35, 35, 35)}
			ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			Thickness={2}
		/>
		<uicorner
			CornerRadius={new UDim(0, 8)}
		/>
	</imagebutton >;
};

const UnitContainer: React.FC<React.InstanceProps<Frame>> = (props) => {
	return <frame
		BackgroundTransparency={1}
		AutomaticSize={Enum.AutomaticSize.Y}
		{...props}
	>
		<uilistlayout
			HorizontalFlex={Enum.UIFlexAlignment.Fill}
			Padding={new UDim(0, 16)}
		/>
		{props.children}
	</frame>;
};

const UnitComponent: React.FC<{
	unit: Unit<any, any>
}> = ({ unit }) => {
	const subs = unit.subordinates as Unit<any, any>[];
	const [expanded, setExpanded] = useState<boolean>(false);

	return <frame
		BackgroundTransparency={1}
		AutomaticSize={Enum.AutomaticSize.XY}
	>
		<UnitCard
			unit={unit}
		/>
		<UnitContainer
			Visible={subs.size() > 0}
		>
			<UnitContainer
				Visible={expanded && subs.size() > 0}
			>
				{subs.map(sub => <UnitComponent
					unit={sub}
				/>)}
			</UnitContainer>
			<uipadding
				PaddingLeft={new UDim(0, 16)}
			/>
			<UnitSubordinateExpander
				expanded={expanded}
				setExpanded={setExpanded}
				enabled={subs.size() > 0}
			/>
		</UnitContainer>
		<uilistlayout
			HorizontalFlex={Enum.UIFlexAlignment.Fill}
			Padding={new UDim(0, 16)}
		/>
	</frame>;
};

export const UnitSelector: React.FC<{
	roots: Unit<any, any>[]
}> = ({ roots }) => {
	return <StyleWindow
		headingProps={{
			Text: "Available units:",
			FontFace: Font.fromName("Roboto", Enum.FontWeight.Bold)
		}}
	>
		<UnitContainer
			Size={UDim2.fromOffset(MAX_UNIT_WIDTH + 32, 0)}
		>
			<uipadding
				PaddingLeft={new UDim(0, 16)}
				PaddingRight={new UDim(0, 16)}
				PaddingBottom={new UDim(0, 16)}
				PaddingTop={new UDim(0, 16)}
			/>
			{roots.map(root => <UnitComponent
				unit={root}
			/>)}
		</UnitContainer>
	</StyleWindow>;
};