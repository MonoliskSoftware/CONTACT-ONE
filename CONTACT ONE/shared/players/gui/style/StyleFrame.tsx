import React from "@rbxts/react";

export const DefaultFrameStyle = {
	BackgroundColor3: Color3.fromRGB(25, 25, 25),
	BorderSizePixel: 0,
	Size: UDim2.fromScale(0, 0),
	AutomaticSize: Enum.AutomaticSize.XY
} satisfies React.InstanceProps<Frame>;

export const DefaultFrameChildren = (
	<React.Fragment>
		<uipadding
			PaddingLeft={new UDim(0, 16)}
			PaddingRight={new UDim(0, 16)}
			PaddingBottom={new UDim(0, 16)}
			PaddingTop={new UDim(0, 16)}
		/>
		<uistroke
			Color={Color3.fromRGB(35, 35, 35)}
			ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			Thickness={2}
		/>
		<uicorner
			CornerRadius={new UDim(0, 16)}
		/>
	</React.Fragment>
);

export const StyleFrame: React.FC<React.InstanceProps<Frame>> = (props) => {
	return <frame
		{...DefaultFrameStyle}
		{...props} >
		{DefaultFrameChildren}
		{props.children}
	</frame>;
};