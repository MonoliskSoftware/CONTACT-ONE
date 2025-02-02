import React, { createContext, useContext, useEffect, useRef, useState } from "@rbxts/react";
import { RunService, StarterGui } from "@rbxts/services";
import { Faction } from "CONTACT ONE/shared/stacks/organization/elements/Faction";
import { GenericUnit } from "CONTACT ONE/shared/stacks/organization/elements/Unit";
import { SpawnManager } from "CORP/shared/Scripts/Networking/SpawnManager";
import { PlayerAssignmentsManager } from "../PlayerAssignmentsManager";
import { StyleButton } from "./style/StyleButton";
import { StyleFrame } from "./style/StyleFrame";
import { StyleTextLabel } from "./style/StyleLabel";

export namespace ORBATViewer {
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	export type WindowProps = {

	} & RootProps

	export interface ElementProps {
		unit: GenericUnit,
		maxDepth: number
	}

	export type RootProps = {
		faction?: Faction,
		root?: GenericUnit
	} & ({ faction: Faction } | { root: GenericUnit });

	const ElementDepthContext = createContext(1);

	const ElementSelectionContext = createContext<{
		selection: string | undefined,
		setSelection: (elementId: string) => void
	} | undefined>(undefined);

	const Element: React.FC<ElementProps> = (props: ElementProps) => {
		const depth = useContext(ElementDepthContext);
		const selectionContext = useContext(ElementSelectionContext);
		const [children, setChildren] = useState<GenericUnit[]>(props.unit.subordinates as GenericUnit[]);

		useEffect(() => {
			const subordinateAddedConnection = props.unit.subordinateAdded.connect(subordinate => setChildren(props.unit.subordinates as GenericUnit[]));
			const subordinateRemovingConnection = props.unit.subordinateRemoving.connect(subordinate => setChildren(props.unit.subordinates.filter(other => other.getId() !== subordinate.getId()) as GenericUnit[]));

			return () => {
				subordinateAddedConnection.disconnect();
				subordinateRemovingConnection.disconnect();
			};
		}, [props.unit]);

		if (selectionContext === undefined) throw "ORBATElement must be used within a ElementSelectionContext.Provider";

		return (
			<frame
				Size={UDim2.fromOffset(0, 0)}
				AutomaticSize={Enum.AutomaticSize.XY}
				BackgroundTransparency={1}
			>
				<imagebutton
					Image={props.unit.classProfile.getValue().iconId}
					Size={UDim2.fromOffset(192, 128)}
					LayoutOrder={0}
					BackgroundTransparency={1}
					Event={{
						Activated: () => selectionContext.setSelection(props.unit.getId())
					}}
				>
				</imagebutton>
				<textlabel
					Text={props.unit.name.getValue()}
					LayoutOrder={1}
				/>
				<frame
					Size={UDim2.fromOffset(0, 0)}
					AutomaticSize={Enum.AutomaticSize.XY}
					BackgroundTransparency={1}
					LayoutOrder={2}
				>
					<ElementDepthContext.Provider
						value={depth + 1}
					>
						{children.map(child => <Element maxDepth={props.maxDepth} unit={child as GenericUnit} />)}
					</ElementDepthContext.Provider>
					<uilistlayout
						HorizontalAlignment={Enum.HorizontalAlignment.Center}
						FillDirection={depth === props.maxDepth ? Enum.FillDirection.Vertical : Enum.FillDirection.Horizontal}
						SortOrder={Enum.SortOrder.LayoutOrder}
					/>
				</frame>
				<uilistlayout
					FillDirection={Enum.FillDirection.Vertical}
					SortOrder={Enum.SortOrder.LayoutOrder}
				/>
			</frame>
		);
	};

	export const Window: React.FC<({ faction: Faction } | { root: GenericUnit })> = ((props: WindowProps) => {
		const [goalPosition, setGoalPosition] = useState(Vector2.zero);
		const [position, setPosition] = useState(Vector2.zero);
		const [offset, setOffset] = useState(Vector2.zero);
		const [isDragging, setIsDragging] = useState(false);

		const [elementSelection, setElementSelection] = useState<string | undefined>(undefined);

		const containerRef = useRef<Frame>(undefined);
		const rootRef = useRef<ImageLabel>(undefined);

		useEffect(() => {
			const connection = RunService.RenderStepped.Connect((deltaTime: number) => {
				setPosition(position.Lerp(goalPosition, deltaTime * 30));
			});

			return () => connection.Disconnect();
		});

		return (
			<ElementSelectionContext.Provider value={{ selection: elementSelection, setSelection: setElementSelection }}>
				<screengui
					ScreenInsets={Enum.ScreenInsets.DeviceSafeInsets}
				>
					<imagelabel
						Size={UDim2.fromScale(1, 1)}
						BackgroundColor3={Color3.fromRGB(15, 15, 15)}
						ImageColor3={Color3.fromRGB(50, 50, 50)}
						Image={"rbxassetid://131452150578318"}
						ScaleType={Enum.ScaleType.Tile}
						BorderSizePixel={0}
						TileSize={UDim2.fromOffset(24, 24)}
						ref={rootRef}
					>
						<textbutton
							Size={UDim2.fromScale(1, 1)}
							BackgroundTransparency={1}
							Text={''}
							Event={{
								MouseButton1Down: (_, x, y) => {
									// Used to offset from core gui insets
									setOffset(new Vector2(x, y)
										.sub(containerRef.current?.AbsolutePosition ?? Vector2.zero)
										.add(rootRef.current?.AbsolutePosition ?? Vector2.zero)
									);
									setIsDragging(true);
								},
								MouseMoved: (_, x, y) => {
									if (isDragging) setGoalPosition(new Vector2(x, y).sub(offset));
								},
								MouseButton1Up: () => setIsDragging(false),
							}}
						>
							<frame
								AutomaticSize={Enum.AutomaticSize.XY}
								Position={UDim2.fromOffset(position.X, position.Y)}
								BackgroundTransparency={1}
								ref={containerRef}
							>
								<uilistlayout
									FillDirection={Enum.FillDirection.Horizontal}
									Padding={new UDim(0, 64)}
								/>
								{(props.faction || props.root) && <Root faction={props.faction} root={props.root as GenericUnit} />}
							</frame>
						</textbutton>
					</imagelabel>
				</screengui>
				<screengui
					ScreenInsets={Enum.ScreenInsets.CoreUISafeInsets}
				>
					<ElementMenu />
				</screengui>
			</ElementSelectionContext.Provider>
		);
	});

	const Root: React.FC<RootProps> = (props: RootProps) => {
		const [elements, setElements] = useState(props.faction ? (props.faction.subordinates as unknown as GenericUnit[]) : [props.root as GenericUnit]);

		useEffect(() => {
			setElements(props.faction ? (props.faction.subordinates as unknown as GenericUnit[]) : [props.root as GenericUnit]);
		}, [props.faction, props.root]);

		useEffect(() => {
			const connections = elements.map(element => element.removing.connect(() => setElements(elements.filter(otherElement => otherElement.getId() !== element.getId()))));

			return () => connections.forEach(conn => conn.disconnect());
		}, [props]);

		return <>
			{elements.map(element => <Element unit={element} maxDepth={4} />)}
		</>;
	};

	const ElementMenu: React.FC = () => {
		const context = React.useContext(ElementSelectionContext);

		if (context === undefined) throw "ORBATElementMenu must be used within a ElementSelectionContext.Provider";

		const currentElement = context.selection !== undefined ? SpawnManager.getNetworkBehaviorById(context.selection) as GenericUnit : undefined;

		StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.PlayerList, false);
		StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Captures, false);
		StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.EmotesMenu, false);
		StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.Health, false);
		StarterGui.SetCoreGuiEnabled(Enum.CoreGuiType.SelfView, false);

		return (
			<frame
				Size={UDim2.fromScale(1, 1)}
				BackgroundTransparency={1}
			>
				{currentElement && (
					<StyleFrame
						Position={UDim2.fromScale(1, 0)}
						AnchorPoint={new Vector2(1, 0)}
						Size={UDim2.fromOffset(512, 0)}
						AutomaticSize={Enum.AutomaticSize.Y}
					>
						<uilistlayout
							FillDirection={Enum.FillDirection.Vertical}
							SortOrder={Enum.SortOrder.LayoutOrder}
							HorizontalFlex={Enum.UIFlexAlignment.Fill}
							Padding={new UDim(0, 8)}
						/>
						<StyleTextLabel
							Text={currentElement.name.getValue()}
							TextSize={48}
							LayoutOrder={0}
							FontFace={Font.fromName("Roboto", Enum.FontWeight.Bold)}
						/>
						<StyleTextLabel
							LayoutOrder={1}
							TextColor3={new Color3(0.5, 0.5, 0.5)}
							TextSize={28}
							Text={`Parent: ${currentElement.parent.getValue().name.getValue()}`}
							FontFace={Font.fromName("Roboto", Enum.FontWeight.Bold)}
						/>
						<StyleTextLabel
							LayoutOrder={2}
							TextSize={28}
							Text={`<b>Class description:</b>${currentElement.classProfile.getValue().description}`}
							FontFace={Font.fromName("Roboto")}
						/>
						<StyleTextLabel
							LayoutOrder={3}
							TextSize={28}
							Text={`<b>Unit description:</b>${currentElement.sizeProfile.getValue().description}`}
							FontFace={Font.fromName("Roboto")}
						/>
						<StyleButton
							LayoutOrder={100}
							Event={{
								Activated: () => PlayerAssignmentsManager.singleton.requestUnitCommandAssumption(currentElement.getId())
							}}
						>
							<StyleTextLabel
								Text={"ASSUME COMMAND"}
								TextSize={28}
								TextWrapped={false}
								FontFace={Font.fromName("Roboto", Enum.FontWeight.Bold)}
							/>
						</StyleButton>
					</StyleFrame>
				)}
				<uipadding
					PaddingLeft={new UDim(0, 16)}
					PaddingRight={new UDim(0, 16)}
					PaddingBottom={new UDim(0, 16)}
					PaddingTop={new UDim(0, 16)}
				/>
			</frame>
		);
	};
}