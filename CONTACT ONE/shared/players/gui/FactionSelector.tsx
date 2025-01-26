import React, { useEffect, useState } from "@rbxts/react";
import { Faction } from "CONTACT ONE/shared/stacks/organization/elements/Faction";
import { SpawnManager } from "CORP/shared/Scripts/Networking/SpawnManager";
import { PlayerAssignmentsManager } from "../PlayerAssignmentsManager";
import { DefaultFrameChildren } from "./style/StyleFrame";
import { StyleTextLabel } from "./style/StyleLabel";

export namespace FactionSelector {
	// eslint-disable-next-line @typescript-eslint/no-empty-object-type
	type SelectorProps = {};

	type CardProps = {
		faction: Faction
	};

	type CarouselProps = {
		factions: Faction[]
	};

	const Card: React.FC<CardProps> = (props: CardProps) => {
		const [name, setName] = useState(props.faction.name.getValue());

		useEffect(() => {
			// Subscribe
			const nameChangedConnection = props.faction.name.onValueChanged.connect(newName => setName(newName));

			return () => {
				nameChangedConnection.disconnect();
			};
		}, [props.faction]);

		return <imagebutton
			Image={""}
			Size={new UDim2(0, 384, 1, 0)}
			BackgroundColor3={Color3.fromRGB(25, 25, 25)}
			Event={{
				Activated: () => PlayerAssignmentsManager.singleton.requestFactionAssignment(props.faction.getId())
			}}
		>
			<frame
				Size={UDim2.fromScale(1, 0.25)}
				Position={UDim2.fromScale(0, 0.75)}
				BackgroundTransparency={1}
			>
				<StyleTextLabel
					Text={name.upper()}
					FontFace={Font.fromName("Roboto", Enum.FontWeight.Bold)}
					TextXAlignment={Enum.TextXAlignment.Center}
					TextYAlignment={Enum.TextYAlignment.Center}
					AnchorPoint={new Vector2(0.5, 0.5)}
					Position={UDim2.fromScale(0.5, 0.5)}
				/>
			</frame>
			{DefaultFrameChildren}
		</imagebutton>;
	};

	const NoFactionsErrorMessage: React.FC = () => {
		return <StyleTextLabel Text={"NO FACTIONS FOUND"} />;
	};

	const Carousel: React.FC<CarouselProps> = (props: CarouselProps) => {
		return <scrollingframe
			Size={UDim2.fromScale(1, 0.8)}
			AnchorPoint={new Vector2(0, 0.5)}
			Position={UDim2.fromScale(0, 0.5)}
			BackgroundTransparency={1}
			AutomaticCanvasSize={Enum.AutomaticSize.X}
			CanvasSize={UDim2.fromScale(0, 0)}
			ScrollingDirection={Enum.ScrollingDirection.X}
		>
			{props.factions.size() > 0 ? props.factions.map(faction => <Card faction={faction} />) : <NoFactionsErrorMessage />}
			<uilistlayout
				FillDirection={Enum.FillDirection.Horizontal}
				Padding={new UDim(0, 16)}
				HorizontalAlignment={Enum.HorizontalAlignment.Center}
				VerticalAlignment={Enum.VerticalAlignment.Center}
			/>
			<uipadding
				PaddingLeft={new UDim(0, 16)}
				PaddingRight={new UDim(0, 16)}
				PaddingBottom={new UDim(0, 16)}
				PaddingTop={new UDim(0, 16)}
			/>
		</scrollingframe>;
	};

	export const Selector: React.FC<SelectorProps> = () => {
		const [factions, setFactions] = useState(SpawnManager.spawnedNetworkBehaviors.filter(behavior => behavior instanceof Faction));

		useEffect(() => {
			// Subscribe to events
			const addedConnection = SpawnManager.onNetworkBehaviorAdded.connect(behavior => {
				if (behavior instanceof Faction) setFactions(previousFactions => [...previousFactions, behavior]);
			});

			const removingConnection = SpawnManager.onNetworkBehaviorDestroying.connect(behavior => {
				if (behavior instanceof Faction) setFactions(previousFactions => previousFactions.filter(other => other !== behavior));
			});

			return () => {
				addedConnection.disconnect();
				removingConnection.disconnect();
			};
		});

		return (
			<>
				{/* background */}
				<screengui
					ScreenInsets={Enum.ScreenInsets.None}
				>
					<frame
						Size={UDim2.fromScale(1, 1)}
						BackgroundColor3={Color3.fromRGB(15, 15, 15)}
						BorderSizePixel={0}
					/>
				</screengui>
				{/* actual stuff */}
				<screengui
					ScreenInsets={Enum.ScreenInsets.CoreUISafeInsets}
				>
					<Carousel factions={factions} />
				</screengui>
			</>
		);
	};
}