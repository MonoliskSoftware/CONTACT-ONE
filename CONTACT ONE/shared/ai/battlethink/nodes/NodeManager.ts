import { Workspace } from "@rbxts/services";
import { AreaNode } from "./Areas";
import { NodeGraph } from "./Graph";

export class NodeManager {
	public static graph: NodeGraph = {
		areas: []
	};

	/**
	 * Imports a node graph from an instance.
	 */
	public static importGraph(root: Folder): NodeGraph {
		return {
			areas: root.GetChildren().filter(child => child.IsA("Part")).map(child => ({
				cover: child.GetChildren().filter(child => child.IsA("Part")).map(child => ({
					position: child.CFrame,
					size: child.Size
				})),
				position: child.CFrame,
				size: child.Size
			} satisfies AreaNode))
		};
	}

	public static setNodeGraph(graph: NodeGraph) {
		this.graph = graph;
	}

	static {
		this.setNodeGraph(this.importGraph(Workspace.FindFirstChild("AreaNodes") as Folder));
	}
}