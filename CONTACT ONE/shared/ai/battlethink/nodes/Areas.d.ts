import { CoverNode } from "./Cover";

export interface AreaNode {
	position: CFrame,
	size: Vector3,
	cover: CoverNode[]
}