import React, { createContext, useContext, useEffect, useState } from "@rbxts/react";
import { BaseElement } from "CONTACT ONE/shared/stacks/organization/BaseElement";
import { Faction } from "CONTACT ONE/shared/stacks/organization/Faction";
import { StyleFrame } from "./style/StyleFrame";
import { StyleTextLabel } from "./style/StyleLabel";

export namespace ORBATViewer {
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	export type WindowProps = {

	} & RootProps

	export interface ElementProps {
		unitElement: BaseElement,
		maxDepth: number
	}

	export type RootProps = {
		faction?: Faction,
		root?: BaseElement
	} & ({ faction: Faction } | { root: BaseElement });

	const ElementDepthContext = createContext(1);

	const ElementSelectionContext = createContext<{
		selection: string | undefined,
		setSelection: (elementId: string) => void
	} | undefined>(undefined);

	const Element: React.FC<ElementProps> = (props: ElementProps) => {
		const depth = useContext(ElementDepthContext);
		const selectionContext = useContext(ElementSelectionContext);
		const [children, setChildren] = useState<BaseElement[]>(props.unitElement.subordinates);

		useEffect(() => {
			const subordinateAddedConnection = props.unitElement.subordinateAdded.connect(subordinate => setChildren(prev => [...prev, subordinate]));
			const subordinateRemovingConnection = props.unitElement.subordinateRemoving.connect(subordinate => setChildren(prev => prev.filter(other => other.getId() !== subordinate.getId())));

			return () => {
				subordinateAddedConnection.disconnect();
				subordinateRemovingConnection.disconnect();
			};
		}, [props.unitElement]);

		if (selectionContext === undefined) throw "ORBATElement must be used within a ElementSelectionContext.Provider";

		return (
			<frame
				Size={UDim2.fromOffset(0, 0)}
				AutomaticSize={Enum.AutomaticSize.XY}
				BackgroundTransparency={1}>
				<imagebutton
					// Image={props.template.iconId}
					Size={UDim2.fromOffset(192, 128)}
					LayoutOrder={0}
					BackgroundTransparency={1}
					Event={{
						Activated: () => selectionContext.setSelection(props.unitElement.getId())
					}}
				>
				</imagebutton>
				<textlabel
					Text={props.unitElement.name.getValue()}
					LayoutOrder={1}
				/>
				<frame
					Size={UDim2.fromOffset(0, 0)}
					AutomaticSize={Enum.AutomaticSize.XY}
					BackgroundTransparency={1}
					LayoutOrder={2}>
					<ElementDepthContext.Provider
						value={depth + 1}
					>
						{props.unitElement.subordinates.map(child => <Element maxDepth={props.maxDepth} unitElement={child} />)}
					</ElementDepthContext.Provider>
					<uilistlayout
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

	export const Window: React.FC<({ faction: Faction } | { root: BaseElement })> = ((props: WindowProps) => {
		const [position, setPosition] = useState(Vector2.zero);
		const [isDragging, setIsDragging] = useState(false);

		const [elementSelection, setElementSelection] = useState<string | undefined>(undefined);

		return (
			<screengui>
				<ElementSelectionContext.Provider value={{ selection: elementSelection, setSelection: setElementSelection }}>
					<imagelabel
						Size={UDim2.fromScale(1, 1)}
						BackgroundColor3={Color3.fromRGB(15, 15, 15)}
						ImageColor3={Color3.fromRGB(50, 50, 50)}
						Image={"rbxassetid://131452150578318"}
						ScaleType={Enum.ScaleType.Tile}
						BorderSizePixel={0}
						TileSize={UDim2.fromOffset(24, 24)}
					>
						<textbutton
							Position={UDim2.fromOffset(position.X, position.Y)}
							Size={UDim2.fromScale(1, 1)}
							BackgroundTransparency={1}
							Text={''}
							Event={{
								MouseButton1Down: () => setIsDragging(true),
								MouseButton1Up: () => setIsDragging(true),
							}}
						>
							{(props.faction || props.root) && <Root faction={props.faction} root={props.root as BaseElement} />}
						</textbutton>
					</imagelabel>
					<ElementMenu />
				</ElementSelectionContext.Provider>
			</screengui>
		);
	});

	const Root: React.FC<RootProps> = (props: RootProps) => {
		const elements: BaseElement[] = props.faction ? props.faction.commandUnits : [props.root as BaseElement];

		return <>
			{elements.map(element => <Element unitElement={element} maxDepth={4} />)}
		</>;
	};

	const ElementMenu: React.FC = () => {
		const context = React.useContext(ElementSelectionContext);

		if (context === undefined) throw "ORBATElementMenu must be used within a ElementSelectionContext.Provider";

		return (
			<frame
				Size={UDim2.fromScale(1, 1)}
				BackgroundTransparency={1}
			>
				<StyleFrame
					Position={UDim2.fromScale(1, 0)}
					AnchorPoint={new Vector2(1, 0)}
				>
					<StyleTextLabel
						Text={"Hi"}
						TextSize={48}
						FontFace={Font.fromName("Roboto", Enum.FontWeight.Bold)}
					/>
				</StyleFrame>
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