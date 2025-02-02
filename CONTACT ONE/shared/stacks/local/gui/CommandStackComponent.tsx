/* eslint-disable @typescript-eslint/no-explicit-any */
import Object from "@rbxts/object-utils";
import React, { SetStateAction, useContext, useEffect, useState } from "@rbxts/react";
import { createPortal } from "@rbxts/react-roblox";
import { Players, RunService, Workspace } from "@rbxts/services";
import { GuiManagerContext } from "CONTACT ONE/shared/players/gui/GuiManagerContext";
import { ButtonDisabledProps, StyleButton } from "CONTACT ONE/shared/players/gui/style/StyleButton";
import { StyleFrame } from "CONTACT ONE/shared/players/gui/style/StyleFrame";
import { StyleTextLabel } from "CONTACT ONE/shared/players/gui/style/StyleLabel";
import { Constructable, dict } from "CORP/shared/Libraries/Utilities";
import { CommandUnit } from "../../organization/elements/CommandUnit";
import { Unit } from "../../organization/elements/Unit";
import { BaseOrder } from "../../organization/orders/BaseOrder";
import { GuardOrder } from "../../organization/orders/GuardOrder";
import { MoveOrder } from "../../organization/orders/MoveOrder";
import { CommandStackBehavior } from "../CommandStackBehavior";
import { StackComponentProps } from "../StackBehavior";
import { StackBehaviorState } from "../StackBehaviorState";

const ALL_ORDERS = [MoveOrder, GuardOrder];

const SelectOption: React.FC<{
	text: string,
	selected: boolean,
	toggleSelected: () => void
}> = ({ text, selected, toggleSelected }) => {
	return (
		<StyleButton
			Event={{
				Activated: () => toggleSelected()
			}}
			AutomaticSize={Enum.AutomaticSize.XY}
		>
			<StyleTextLabel
				Text={text}
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

const UnitSelectorUnit: React.FC<{
	unit: Unit<any, any>,
	selected: boolean,
	toggleSelected: () => void
}> = ({ unit, selected, toggleSelected }) => {
	return <SelectOption
		text={unit.name.getValue()}
		selected={selected}
		toggleSelected={toggleSelected}
	/>;
};

const CommandUnitSelector: React.FC<{
	options: CommandUnit[],
	selection: CommandUnit | undefined,
	setSelection: (unit: CommandUnit | undefined) => void
}> = ({ options, selection, setSelection }) => {
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
			{options.map(option => <UnitSelectorUnit
				unit={option}
				selected={selection === option}
				toggleSelected={() => {
					if (selection !== option) setSelection(option);
				}}
			/>)}
		</frame>
	);
};

const OrderSelector: React.FC<{
	orders: BaseOrder<any, any>[],
	selectedOrders: BaseOrder<any, any>[],
	setSelectedOrders: (orders: BaseOrder<any, any>[]) => void
}> = ({ selectedOrders, orders, setSelectedOrders }) => {
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
			{orders.map(option => <SelectOption
				text={option.getConfig().name}
				selected={selectedOrders.includes(option)}
				toggleSelected={() => {
					if (selectedOrders.includes(option)) {
						setSelectedOrders(selectedOrders.filter(otherOption => otherOption !== option));
					} else {
						setSelectedOrders([...selectedOrders, option]);
					}
				}}
			/>)}
		</frame>
	);
};

const SubordinateSelector: React.FC<{
	rootUnit: Unit<any, Unit<any, any>>,
	selection: Unit<any, any>[],
	setSelection: (action: Unit<any, any>[]) => void;
}> = ({ rootUnit, selection, setSelection }) => {
	const [subordinates, setSubordinates] = useState([...rootUnit.subordinates, rootUnit]);

	useEffect(() => {
		const subAddedConn = rootUnit.subordinateAdded.connect(() => setSubordinates([...rootUnit.subordinates, rootUnit]));
		const subRemovedConn = rootUnit.subordinateRemoving.connect(() => setSubordinates([...rootUnit.subordinates, rootUnit]));

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
			{subordinates.map(sub => <UnitSelectorUnit
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

function castLookRay(camera: Camera) {
	const result = Workspace.Raycast(camera.CFrame.Position, camera.CFrame.LookVector.mul(1024));

	return result ? result.Position : camera.CFrame.Position.add(camera.CFrame.LookVector.mul(1024));
}

const Vector3Editor: React.FC<{
	enabled: boolean,
	value: Vector3,
	setValue: (value: Vector3) => void
}> = ({ enabled, value, setValue }) => {
	const [isVisible, setIsVisible] = useState(false);
	const [position, setPosition] = useState<[Vector3, UDim2]>([value, UDim2.fromScale(0, 0)]);

	useEffect(() => {
		if (!enabled) setValue(position[0]);

		RunService.BindToRenderStep("Vector3EditorUpdate", Enum.RenderPriority.Camera.Value, () => {
			const camera = Workspace.CurrentCamera as Camera;
			const currentPosition = enabled ? castLookRay(camera) : position[0];

			const [screenPosition, visible] = camera.WorldToScreenPoint(currentPosition);

			setPosition([currentPosition, UDim2.fromOffset(screenPosition.X, screenPosition.Y)]);

			if (visible !== isVisible) setIsVisible(visible);
		});

		return () => RunService.UnbindFromRenderStep("Vector3EditorUpdate");
	}, [enabled]);

	return createPortal((<>
		<screengui>
			<frame
				Size={UDim2.fromOffset(32, 32)}
				AnchorPoint={Vector2.one.mul(0.5)}
				BorderSizePixel={0}
				Position={position[1]}
				Visible={isVisible}
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
	name: string
	value: Vector3,
	setValue: (value: Vector3) => void
}> = ({ name, value, setValue }) => {
	const [isEditing, setIsEditing] = useState(false);

	return (
		<frame
			BackgroundTransparency={1}
			AutomaticSize={Enum.AutomaticSize.Y}
		>
			<Vector3Editor
				enabled={isEditing}
				value={value}
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
					return <OrderPropertyEditor name={key as string} value={(order.executionParameters.getValue() as dict)[key as string]} setValue={(newValue) => {
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
	orders: BaseOrder<any, any>[],
	setOrders: (state: SetStateAction<BaseOrder<any, any>[]>) => void
}> = ({ rootUnit, orders, setOrders }) => {
	const [selection, setSelection] = useState<Unit<any, any>[]>(orders.size() === 1 ? orders[0].getAssignedUnits() : []);

	useEffect(() => {
		if (orders.size() === 1) {
			const conn = orders[0].assignedUnitIds.onValueChanged.connect(() => setSelection(orders.size() === 1 ? orders[0].getAssignedUnits() : []));

			setSelection(orders[0].getAssignedUnits());

			return () => conn.disconnect();
		}
	}, [orders]);

	return <frame
		AutomaticSize={Enum.AutomaticSize.XY}
		BackgroundTransparency={1}
		Size={UDim2.fromOffset(384, 0)}
	>
		{
			rootUnit && orders.size() === 1 ? <>
				<OrderPropertiesEditor
					order={orders[0]}
				/>
				<SubordinateSelector
					rootUnit={rootUnit}
					selection={selection}
					setSelection={(newSelection: Unit<any, any>[]) => {
						orders[0].trySetAssignedUnits(newSelection.map(unit => unit.getId()));
					}}
				/>
			</> : <></>
		}
		{
			rootUnit && orders.size() > 0 ? <StyleButton
				Event={{
					Activated: () => orders.forEach(order => order.tryExecute())
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
			</StyleButton> : <></>
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
	rootUnits: CommandUnit[],
	commandUnit: CommandUnit | undefined,
	setCommandUnit: (unit: CommandUnit | undefined) => void,
	orders: BaseOrder<any, any>[],
	setOrders: (state: SetStateAction<BaseOrder<any, any>[]>) => void
}> = ({ orders, commandUnit, setCommandUnit, rootUnits, setOrders }) => {
	const [availableOrders, setAvailableOrders] = useState<Constructable<BaseOrder<any, any>>[]>(ALL_ORDERS);

	return <frame
		AutomaticSize={Enum.AutomaticSize.XY}
		BackgroundTransparency={1}
	>
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
							if (commandUnit) {
								const order = commandUnit.createOrder(availableOrder, false);

								setOrders([order]);
							}
						}
					}}
					{...(commandUnit === undefined ? ButtonDisabledProps : {})}
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
		<CommandUnitSelector
			options={rootUnits}
			selection={commandUnit}
			setSelection={setCommandUnit}
		/>
		{commandUnit ? <OrderSelector
			orders={commandUnit.associatedOrders}
			setSelectedOrders={setOrders}
			selectedOrders={orders}
		/> : <></>}
		<uilistlayout
			FillDirection={Enum.FillDirection.Vertical}
			Padding={new UDim(0, 16)}
			HorizontalFlex={Enum.UIFlexAlignment.Fill}
			SortOrder={Enum.SortOrder.LayoutOrder}
		/>
	</frame >;
};

const EliminatedScreen: React.FC<StackComponentProps<CommandStackBehavior>> = (props: StackComponentProps<CommandStackBehavior>) => {
	const guiManagerContext = useContext(GuiManagerContext);

	assert(guiManagerContext);

	return <textbutton
		Text={"go to menu"}
		Event={{
			Activated: () => props.behavior.tryExit()
		}}
		TextSize={100}
		AutomaticSize={Enum.AutomaticSize.XY}
	/>;
};

export const CommandStackComponent: React.FC<StackComponentProps<CommandStackBehavior>> = (props: StackComponentProps<CommandStackBehavior>) => {
	const guiManagerContext = useContext(GuiManagerContext);

	assert(guiManagerContext);

	const [controlledUnits, setControlledUnits] = useState<CommandUnit[]>(guiManagerContext.playerBehavior.commandedUnits);
	const [selectedOrders, setSelectedOrders] = useState<BaseOrder<any, any>[]>([]);
	const [commandUnit, setCommandUnit] = useState<CommandUnit | undefined>();
	const [behaviorState, setBehaviorState] = useState(props.behavior.state.getValue());

	useEffect(() => {
		const conn = props.behavior.state.onValueChanged.connect(state => setBehaviorState(state));

		return () => conn.disconnect();
	}, [props.behavior]);

	useEffect(() => {
		const conn = guiManagerContext.playerBehavior.commandedUnitsChanged.connect(() => setControlledUnits(guiManagerContext.playerBehavior.commandedUnits));

		return () => conn.disconnect();
	});

	useEffect(() => {
		const conns = selectedOrders.map(order => order.removing.connect(() => setSelectedOrders(orders => orders.filter(otherOrder => otherOrder !== order))));

		return () => conns.forEach(conn => conn.disconnect());
	}, [selectedOrders]);

	useEffect(() => {
		const conn = commandUnit?.removing.connect(() => setCommandUnit(undefined));

		return () => conn?.disconnect();
	}, [commandUnit]);

	return (
		<screengui>
			{behaviorState === StackBehaviorState.ELIMINATED ? <EliminatedScreen {...props} /> : <>
				<OrderEditor
					rootUnit={commandUnit as Unit<any, any>}
					orders={selectedOrders}
					setOrders={setSelectedOrders}
				/>
				<frame
					BackgroundTransparency={1}
				>
					<uiflexitem
						FlexMode={Enum.UIFlexMode.Grow}
					/>
				</frame>
				<OrderCreator
					rootUnits={controlledUnits as CommandUnit[]}
					commandUnit={commandUnit}
					setCommandUnit={setCommandUnit}
					orders={selectedOrders}
					setOrders={setSelectedOrders}
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
			</>}
			{/* <UnitSelector 
				roots={controlledUnits}
			/> */}

		</screengui>
	);
};