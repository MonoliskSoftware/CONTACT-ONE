import React from "@rbxts/react";
import { DefaultTextLabelChildren, DefaultTextLabelStyle } from "./StyleLabel";

export const DefaultWindowStyle = {
	BackgroundColor3: Color3.fromRGB(15, 15, 15),
	BorderSizePixel: 0,
	Size: UDim2.fromScale(0, 0),
	AutomaticSize: Enum.AutomaticSize.XY
} satisfies React.InstanceProps<Frame>;

export const DefaultWindowChildren = (
	<React.Fragment>
		<frame
			Size={UDim2.fromOffset(0, 2)}
			BorderSizePixel={0}
			BackgroundColor3={Color3.fromRGB(35, 35, 35)}
		/>
		<uistroke
			Color={Color3.fromRGB(35, 35, 35)}
			ApplyStrokeMode={Enum.ApplyStrokeMode.Border}
			Thickness={2}
		/>
		<uicorner
			CornerRadius={new UDim(0, 8)}
		/>
		<uilistlayout
			HorizontalFlex={Enum.UIFlexAlignment.Fill}
		/>
	</React.Fragment>
);

export const WindowHeading: React.FC<React.InstanceProps<TextLabel>> = (props) => {
	return <textlabel
		{...DefaultTextLabelStyle}
		Size={UDim2.fromOffset(0, 48)}
		{...props}
	>
		{DefaultTextLabelChildren}
		<uipadding
			PaddingLeft={new UDim(0, 12)}
			PaddingRight={new UDim(0, 12)}
		/>
	</textlabel>;
};

export const StyleWindow: React.FC<React.PropsWithChildren<{
	headingProps?: React.InstanceProps<TextLabel>,
	windowProps?: React.InstanceProps<Frame>
}>> = (props) => {
	return <frame
		{...DefaultWindowStyle}
		{...props.windowProps} >
		<WindowHeading {...props.headingProps} />
		{DefaultWindowChildren}
		{props.children}
	</frame>;
};