import React from "@rbxts/react";

export const DefaultImageButtonStyle = {
	BackgroundColor3: Color3.fromRGB(45, 45, 45),
	BorderSizePixel: 0,
	Size: UDim2.fromScale(0, 0),
	AutomaticSize: Enum.AutomaticSize.XY,
	ImageTransparency: 1
} satisfies React.InstanceProps<ImageButton>;

export const ButtonDisabledProps = {
	AutoButtonColor: false,
} satisfies React.InstanceProps<ImageButton>;

export const DefaultImageButtonChildren = (
	<React.Fragment>
		<uipadding
			PaddingLeft={new UDim(0, 16)}
			PaddingRight={new UDim(0, 16)}
			PaddingBottom={new UDim(0, 16)}
			PaddingTop={new UDim(0, 16)}
		/>
		<uistroke
			Color={Color3.fromRGB(55, 55, 55)}
			ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			Thickness={2}
		/>
		<uicorner
			CornerRadius={new UDim(0, 8)}
		/>
	</React.Fragment>
);

export const StyleButton: React.FC<React.InstanceProps<ImageButton>> = (props) => {
	return <imagebutton
		{...DefaultImageButtonStyle}
		{...props}
	>
		{DefaultImageButtonChildren}
		{props.children}
	</imagebutton>;
};