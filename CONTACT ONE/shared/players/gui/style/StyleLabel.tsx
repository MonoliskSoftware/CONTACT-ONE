import React from "@rbxts/react";

export const DefaultTextLabelStyle = {
	BackgroundTransparency: 1,
	AutomaticSize: Enum.AutomaticSize.XY,
	Size: UDim2.fromScale(0, 0),
	TextColor3: new Color3(1, 1, 1),
	TextSize: 32,
	TextWrapped: true,
	TextXAlignment: Enum.TextXAlignment.Left,
	FontFace: Font.fromName("Roboto")
} satisfies React.InstanceProps<TextLabel>;

export const DefaultTextLabelChildren = (
	<React.Fragment>
		<uigradient
			Color={new ColorSequence(Color3.fromRGB(255, 255, 255), Color3.fromRGB(200, 200, 200))}
			Rotation={90}
		/>
	</React.Fragment>
);

export const StyleTextLabel: React.FC<React.InstanceProps<TextLabel>> = (props) => {
	return <textlabel
		{...DefaultTextLabelStyle}
		{...props} >
		{DefaultTextLabelChildren}
		{props.children}
	</textlabel>;
};