import { Workspace } from "@rbxts/services";

export class Visualization {
	private debugParts = new Map<number, [Part, Attachment, Beam | undefined]>();
	private index: number = 0;

	public setWaypoints(waypoints: Vector3[]) {
		this.debugParts.forEach(([part]) => part.Destroy());
		this.debugParts.clear();

		const parts: [Part, Attachment, Beam | undefined][] = [];

		waypoints.forEach((waypoint, index) => {
			const part = new Instance("Part");

			part.CanCollide = false;
			part.Anchored = true;
			part.CastShadow = false;
			part.Color = new Color3(1, 1, 1);
			part.Shape = Enum.PartType.Ball;
			part.Parent = Workspace;
			part.Name = `Waypoint${index}`;
			part.Material = Enum.Material.Neon;
			part.Position = waypoint;

			const attachment = new Instance("Attachment");

			attachment.Parent = part;

			let beam;

			if (index > 0) {
				beam = new Instance("Beam");

				beam.Parent = Workspace.Terrain;
				beam.Color = new ColorSequence(new Color3(1, 1, 1));
				beam.FaceCamera = true;
				beam.Attachment0 = parts[index - 1][1];
				beam.Attachment1 = attachment;
			}

			parts[index] = [part, attachment, beam];
		});

		this.debugParts = new Map(parts.map((part, index) => [index, part]));

		this.updateWaypoints();
	}

	public updateWaypoints() {
		this.debugParts.forEach(([part, , beam], index) => {
			let color = new Color3(1, 1, 1);

			if (index < this.index) {
				color = Color3.fromRGB(85, 255, 85);
			} else if (index === this.index) {
				color = Color3.fromRGB(0, 85, 255);
			} else if (index > this.index) {
				color = Color3.fromRGB(255, 85, 85);
			}

			if (beam) beam.Color = new ColorSequence(color);
			part.Color = color;
		});
	}

	public setIndex(index: number) {
		this.index = index;

		this.updateWaypoints();
	}
}