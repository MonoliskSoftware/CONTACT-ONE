import { PhysicsService, RunService } from "@rbxts/services";

export namespace CharacterPhysics {
	export const PHYSICS_GROUP_CHARACTER = "Character";
	export const PHYSICS_GROUP_CHARACTER_COLLIDER = "CharacterCollider";
	export const PHYSICS_GROUP_DEFAULT = "Default";

	export const CHARACTER_COLLIDER_SIZE = new Vector3(3, 3, 3);
	export const CHARACTER_COLLIDER_OFFSET = new Vector3(0, 0, 0);
	
	if (RunService.IsServer()) {
		PhysicsService.RegisterCollisionGroup(PHYSICS_GROUP_CHARACTER);
		PhysicsService.CollisionGroupSetCollidable(PHYSICS_GROUP_CHARACTER, PHYSICS_GROUP_CHARACTER, false);
		
		PhysicsService.RegisterCollisionGroup(PHYSICS_GROUP_CHARACTER_COLLIDER);
		PhysicsService.CollisionGroupSetCollidable(PHYSICS_GROUP_CHARACTER_COLLIDER, PHYSICS_GROUP_CHARACTER_COLLIDER, false);
		PhysicsService.CollisionGroupSetCollidable(PHYSICS_GROUP_CHARACTER_COLLIDER, PHYSICS_GROUP_CHARACTER, false);
		PhysicsService.CollisionGroupSetCollidable(PHYSICS_GROUP_CHARACTER_COLLIDER, PHYSICS_GROUP_DEFAULT, true);
	}
}