import React from "@rbxts/react";
import { createPortal } from "@rbxts/react-roblox";
import { Lighting } from "@rbxts/services";
import { EnvironmentManager } from "CONTACT ONE/shared/environment/EnvironmentManager";
import { GameStateManager } from "CONTACT ONE/shared/flow/GameStateManager";
import { StyleTextLabel } from "../style/StyleLabel";

const DebriefingLighting: React.FC = () => {
	return <>
		<blureffect
			Size={24}
		/>
		<colorcorrectioneffect
			Contrast={-0.5}
			Brightness={-0.75}
			Saturation={-1 - EnvironmentManager.getSingleton().getTotalBaseSaturation()}
		/>
	</>;
};

export const Debriefing: React.FC = () => {
	return (
		<screengui>
			{createPortal(<DebriefingLighting />, Lighting)}
			<StyleTextLabel 
				Text={`Winner: ${GameStateManager.getSingleton().lastWin.getValue().winningFaction}`}
			/>
		</screengui>
	);
};