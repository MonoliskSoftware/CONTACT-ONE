/* eslint-disable @typescript-eslint/no-explicit-any */
import Object from "@rbxts/object-utils";
import React, { SetStateAction, useContext, useEffect, useState } from "@rbxts/react";
import { createPortal } from "@rbxts/react-roblox";
import { Players, RunService, Workspace } from "@rbxts/services";
import { GuiManagerContext } from "CONTACT ONE/shared/players/gui/GuiManagerContext";
import { StyleButton } from "CONTACT ONE/shared/players/gui/style/StyleButton";
import { StyleFrame } from "CONTACT ONE/shared/players/gui/style/StyleFrame";
import { StyleTextLabel } from "CONTACT ONE/shared/players/gui/style/StyleLabel";
import { LogGroup } from "CORP/shared/Libraries/Logging";
import { Constructable, dict } from "CORP/shared/Libraries/Utilities";
import { CommandUnit } from "../../organization/elements/CommandUnit";
import { Unit } from "../../organization/elements/Unit";
import { BaseOrder } from "../../organization/orders/BaseOrder";
import { MoveOrder } from "../../organization/orders/MoveOrder";
import { CommandStackBehavior } from "../CommandStackBehavior";
import { StackComponentProps } from "../StackBehavior";

const CommandStackComponentLogGroup: LogGroup = {
	prefix: "COMMAND_STACK.GUI"
};

const SubordinateSelectorUnit: React.FC<{
	unit: Unit<any, any>,
	selected: boolean,
	toggleSelected: () => void
}> = ({ unit, selected, toggleSelected }) => {
	return (
		<StyleButton
			Event={{
				Activated: () => toggleSelected()
			}}
			AutomaticSize={Enum.AutomaticSize.XY}
		>
			<StyleTextLabel
				Text={unit.name.getValue()}
				FontFace={Font.fromName("Roboto", Enum.FontWeight.Bold)}
				TextSize={24}
				Position={UDim2.fromOffset(0, 0)}
				AnchorPoint={Vector2.zero}
			/>
			<frame
				Size={new UDim2(1, 32, 1, 32)}
				Position={UDim2.fromScale(0.5, 0.5)}
				AnchorPoint={Vector2.one.mul(0.5)}
				BackgroundTransparency={1}
			>
				<uistroke
					Color={Color3.fromHex("0055ff")}
					Thickness={selected ? 4 : 0}
				/>
				<uicorner
					CornerRadius={new UDim(0, 8)}
				/>
			</frame>
		</StyleButton>
	);
};

const SubordinateSelector: React.FC<{
	rootUnit: Unit<any, Unit<any, any>>,
	selection: Unit<any, any>[],
	setSelection: (action: Unit<any, any>[]) => void;
}> = ({ rootUnit, selection, setSelection }) => {
	const [subordinates, setSubordinates] = useState(rootUnit.subordinates);

	useEffect(() => {
		const subAddedConn = rootUnit.subordinateAdded.connect(sub => setSubordinates([...subordinates, sub]));
		const subRemovedConn = rootUnit.subordinateRemoving.connect(sub => setSubordinates(subordinates.filter(otherSub => otherSub !== sub)));

		return () => {
			subAddedConn.disconnect();
			subRemovedConn.disconnect();
		};
	}, [rootUnit]);

	return (
		<frame
			AutomaticSize={Enum.AutomaticSize.XY}
			BackgroundTransparency={1}
		>
			<uilistlayout
				FillDirection={Enum.FillDirection.Vertical}
				Padding={new UDim(0, 16)}
				HorizontalFlex={Enum.UIFlexAlignment.Fill}
				SortOrder={Enum.SortOrder.LayoutOrder}
			/>
			{subordinates.map(sub => <SubordinateSelectorUnit
				unit={sub}
				selected={selection.includes(sub)}
				toggleSelected={() => {
					if (selection.includes(sub)) {
						setSelection(selection.filter(otherSub => otherSub !== sub));
					} else {
						setSelection([...selection, sub]);
					}
				}}
			/>)}
		</frame>
	);
};

const Vector3Editor: React.FC<{
	enabled: boolean,
	setValue: (value: Vector3) => void
}> = ({ enabled, setValue }) => {
	const [vPosition, setVPosition] = useState<[Vector3, UDim2, boolean]>([Vector3.zero, UDim2.fromOffset(0, 0), true]);

	useEffect(() => {
		RunService.BindToRenderStep("Vector3EditorUpdate", Enum.RenderPriority.Camera.Value, () => {
			assert(Workspace.CurrentCamera);

			let override = vPosition[0];

			if (enabled) {
				const cf = Workspace.CurrentCamera.CFrame;
				const result = Workspace.Raycast(cf.Position, cf.LookVector.mul(1024));

				if (result)
					override = result.Position;
			}


			const [v, i] = Workspace.CurrentCamera.WorldToViewportPoint(override);
			const a = UDim2.fromOffset(v.X, v.Y);
			setVPosition([override, a, i]);
		});

		if (!enabled) setValue(vPosition[0]);

		return () => {
			RunService.UnbindFromRenderStep("Vector3EditorUpdate");
		};
	}, [enabled]);

	assert(Workspace.CurrentCamera);

	return createPortal((<>
		<screengui>
			<frame
				Size={UDim2.fromOffset(32, 32)}
				AnchorPoint={Vector2.one.mul(0.5)}
				BorderSizePixel={0}
				Position={vPosition[1]}
				Visible={vPosition[2]}
				BackgroundColor3={Color3.fromHex("0055ff")}
			>
				<uicorner
					CornerRadius={new UDim(1, 0)}
				/>
			</frame>
		</screengui>
	</>), Players.LocalPlayer.WaitForChild("PlayerGui"));
};

const OrderPropertyEditor: React.FC<{
	sourceType: Vector3,
	name: string
	value: Vector3,
	setValue: (value: Vector3) => void
}> = ({ sourceType, name, value, setValue }) => {
	const [isEditing, setIsEditing] = useState(false);

	return (
		<frame
			BackgroundTransparency={1}
			AutomaticSize={Enum.AutomaticSize.Y}
		>
			<Vector3Editor
				enabled={isEditing}
				setValue={setValue}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				HorizontalFlex={Enum.UIFlexAlignment.Fill}
				VerticalAlignment={Enum.VerticalAlignment.Center}
			/>
			<StyleTextLabel
				Text={name.upper()}
				TextXAlignment={Enum.TextXAlignment.Left}
			/>
			<StyleButton
				Position={UDim2.fromScale(1, 0)}
				AnchorPoint={new Vector2(1, 0)}
				Event={{
					Activated: () => {
						setIsEditing(!isEditing);
					}
				}}
			>
				<StyleTextLabel
					Text={"Edit"}
				/>
			</StyleButton>
		</frame>
	);
};

const OrderPropertiesEditor: React.FC<{
	order: BaseOrder<any, any>
}> = ({ order }) => {
	return (
		<StyleFrame
			Size={UDim2.fromOffset(384, 0)}
		>
			<StyleTextLabel
				TextSize={32}
				Text={"Order Settings"}
				FontFace={Font.fromName("Roboto", Enum.FontWeight.Bold)}
			/>
			{
				Object.entries(order.executionParameterSpecification as { [key: string]: Vector3 }).map(([key, value]) => {
					return <OrderPropertyEditor name={key as string} value={(order.executionParameters as dict)[key as string]} sourceType={value} setValue={(newValue) => {
						const newParams = order.executionParameters.getValue() as dict;

						newParams[key] = newValue;

						order.trySetParameters(newParams);
					}} />;
				})
			}
			<uilistlayout
				HorizontalFlex={Enum.UIFlexAlignment.Fill}
				FillDirection={Enum.FillDirection.Vertical}
				Padding={new UDim(0, 8)}
			/>
		</StyleFrame>
	);
};

const OrderEditor: React.FC<{
	rootUnit: Unit<any, Unit<any, any>>,
	order: BaseOrder<any, any> | undefined,
	setOrder: (state: SetStateAction<BaseOrder<any, any> | undefined>) => void
}> = ({ rootUnit, order, setOrder }) => {
	const [selection, setSelection] = useState<Unit<any, any>[]>(order ? order.getAssignedUnits() : []);

	useEffect(() => {
		order?.assignedUnitIds.onValueChanged.connect(() => setSelection(order ? order.getAssignedUnits() : []));

		setSelection(order ? order.getAssignedUnits() : []);
	}, [order]);

	return <frame
		AutomaticSize={Enum.AutomaticSize.XY}
		BackgroundTransparency={1}
	>
		{
			order ? <>
				<OrderPropertiesEditor
					order={order}
				/>
				<SubordinateSelector
					rootUnit={rootUnit}
					selection={selection}
					setSelection={(newSelection: Unit<any, any>[]) => {
						order.trySetAssignedUnits(newSelection.map(unit => unit.getId()));
					}}
				/>
				<StyleButton
					Event={{
						Activated: () => order.tryExecute()
					}}
				>
					<StyleTextLabel
						Text={"EXECUTE"}
						Position={UDim2.fromScale(0.5, 0)}
						AnchorPoint={new Vector2(0.5, 0)}
						TextSize={42}
						TextWrapped={false}
						FontFace={Font.fromName("Roboto", Enum.FontWeight.Bold)}
					/>
				</StyleButton>
			</> : <textlabel Text={"NO SELECTED ORDER"} />
		}
		<uilistlayout
			FillDirection={Enum.FillDirection.Vertical}
			Padding={new UDim(0, 16)}
			HorizontalFlex={Enum.UIFlexAlignment.Fill}
			SortOrder={Enum.SortOrder.LayoutOrder}
		/>
	</frame >;
};

const OrderCreator: React.FC<{
	rootUnit: CommandUnit,
	setOrder: (state: SetStateAction<BaseOrder<any, any> | undefined>) => void
}> = ({ rootUnit, setOrder }) => {
	const [availableOrders, setAvailableOrders] = useState<Constructable<BaseOrder<any, any>>[]>([MoveOrder]);

	return (
		<StyleFrame
			Size={UDim2.fromOffset(512, 0)}
			AutomaticSize={Enum.AutomaticSize.Y}
		>
			<StyleTextLabel
				TextSize={32}
				Text={"Order Creator"}
				FontFace={Font.fromName("Roboto", Enum.FontWeight.Bold)}
			/>
			{availableOrders.map(availableOrder => {
				return <StyleButton
					Event={{
						Activated: () => {
							const order = rootUnit.createOrder(availableOrder, false);

							setOrder(order);
						}
					}}
				>
					<StyleTextLabel
						Text={(availableOrder as unknown as BaseOrder<any, any>).getConfig().name.upper()}
						FontFace={Font.fromName("Roboto", Enum.FontWeight.Bold)}
						TextSize={32}
					/>
				</StyleButton>;
			})}
			<uilistlayout
				HorizontalFlex={Enum.UIFlexAlignment.Fill}
				FillDirection={Enum.FillDirection.Vertical}
				Padding={new UDim(0, 8)}
			/>
		</StyleFrame>
	);
};

export const CommandStackComponent: React.FC<StackComponentProps<CommandStackBehavior>> = (props: StackComponentProps<CommandStackBehavior>) => {
	const guiManagerContext = useContext(GuiManagerContext);

	assert(guiManagerContext);

	const [controlledUnit, setControlledUnit] = useState<CommandUnit | undefined>(guiManagerContext.playerBehavior.commandedUnits[0]);
	const [currentOrder, setCurrentOrder] = useState<BaseOrder<any, any> | undefined>(undefined);

	useEffect(() => {
		const conn = guiManagerContext.playerBehavior.commandedUnitsChanged.connect(() => setControlledUnit(guiManagerContext.playerBehavior.commandedUnits[0]));

		return () => conn.disconnect();
	});

	return (
		<screengui>
			<OrderEditor
				rootUnit={controlledUnit as Unit<any, Unit<any, any>>}
				order={currentOrder}
				setOrder={setCurrentOrder}
			/>
			<frame
				BackgroundTransparency={1}
			>
				<uiflexitem
					FlexMode={Enum.UIFlexMode.Grow}
				/>
			</frame>
			<OrderCreator
				rootUnit={controlledUnit as CommandUnit}
				setOrder={setCurrentOrder}
			/>
			<uipadding
				PaddingLeft={new UDim(0, 16)}
				PaddingRight={new UDim(0, 16)}
				PaddingBottom={new UDim(0, 16)}
				PaddingTop={new UDim(0, 16)}
			/>
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
			/>
			{/* <textbutton
				Text={"CREATE MOVE ORDER"}
				Size={UDim2.fromOffset(200, 200)}
				Event={{
					Activated: () => {
						Logging.print(CommandStackComponentLogGroup, `Received instruction to create move order. Current unit id: ${controlledUnit?.getId()}`);

						const order = controlledUnit?.createOrder(MoveOrder, {
							position: props.behavior.viewer.getValue().GetPivot().Position
						});

						Logging.print(CommandStackComponentLogGroup, `Resultant order id: ${order?.getId()}`);

						setCurrentOrder(order);
					}
				}}
			/>
			{<textbutton
				Text={"EXECUTE ORDER"}
				Size={UDim2.fromOffset(200, 50)}
				Visible={currentOrder !== undefined}
				Event={{
					Activated: () => {
						assert(currentOrder);

						currentOrder.tryExecute();
					}
				}}
			/>}
			{controlledUnit?.subordinates.map(sub => <UnitUnderOrders unit={sub} currentOrder={currentOrder} />)} */}
		</screengui>
	);
};