export abstract class BaseOcclusion {
	/**
	 * Called when character is added
	 * 
	 * @virtual
	 */
	CharacterAdded(char: Model, player: Player): void { }
	/**
	 * Called when character about to be removed
	 * 
	 * @virtual
	 */
	CharacterRemoving(char: Model, player: Player): void { }

	OnCameraSubjectChanged(newSubject: Instance | undefined): void { }

	abstract GetOcclusionMode(): Enum.DevCameraOcclusionMode | undefined;

	abstract Enable(enabled: boolean): void;

	abstract Update(dt: number, desiredCameraCFrame: CFrame, desiredCameraFocus: CFrame): LuaTuple<[CFrame, CFrame]>;
}