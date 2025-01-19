// //!nonstrict
// //[[
// 	// Original By Kip Turner, Copyright Roblox 2014
// 	// Updated by Garnold to utilize the new PathfindingService API, 2017
// 	// 2018 PlayerScripts Update - AllYourBlox

// import { Players, Workspace, CollectionService, PathfindingService, StarterGui, UserInputService, GuiService } from "@rbxts/services"
// import { FlagUtil } from "../FlagUtil"

// const FFlagUserRaycastPerformanceImprovements = FlagUtil.getUserFlag("UserRaycastPerformanceImprovements")
// const FFlagUserExcludeNonCollidableForPathfinding = FlagUtil.getUserFlag("UserExcludeNonCollidableForPathfinding")
// const FFlagUserClickToMoveSupportAgentCanClimb = FlagUtil.getUserFlag("UserClickToMoveSupportAgentCanClimb2")

// //[[ Configuration ]]
// const ShowPath = true
// const PlayFailureAnimation = true
// const UseDirectPath = false
// const UseDirectPathForVehicle = true
// const AgentSizeIncreaseFactor = 1.0
// const UnreachableWaypointTimeout = 8

// //[[ Constants ]]//
// const movementKeys = {
// 	[Enum.KeyCode.W] : true,
// 	[Enum.KeyCode.A] : true,
// 	[Enum.KeyCode.S] : true,
// 	[Enum.KeyCode.D]: true,
// 	[Enum.KeyCode.Up]: true,
// 	[Enum.KeyCode.Down]: true,
// }

// const Player = Players.LocalPlayer

// const ZERO_VECTOR3 = Vector3.new(0,0,0)
// const ALMOST_ZERO = 0.000001

// const raycastParams = RaycastParams.new()
// raycastParams.FilterType = Enum.RaycastFilterType.Exclude

// /**
//  * //////////////////////////UTIL LIBRARY//////////////////////////////
//  */
// export namespace Utility {
// 	export function FindCharacterAncestor(part: BasePart) {
// 		assert(FFlagUserRaycastPerformanceImprovements);

// 		if( part ){
// 			const humanoid = part.FindFirstChildOfClass("Humanoid")
// 			if( humanoid ){
// 				return [part, humanoid]
// 			}else{
// 				return FindCharacterAncestor(part.Parent)
// 			}
// 		}
// 	}

// 	export function Raycast(ray: Ray, ignoreNonCollidable: boolean, ignoreList?: Model[] = []) {
// 		assert(FFlagUserRaycastPerformanceImprovements);

// 		const [hitPart, hitPos, hitNorm, hitMat] = Workspace.FindPartOnRayWithIgnoreList(ray, ignoreList)

// 		if( hitPart ){
// 			if( ignoreNonCollidable && hitPart.CanCollide === false ){
// 				// We always include character parts so a user can click on another character
// 				// to walk to them.
// 				const _, humanoid = FindCharacterAncestor(hitPart)
// 				if( humanoid === undefined ){
// 					ignoreList.push(hitPart);
					
// 					return Raycast(ray, ignoreNonCollidable, ignoreList)
// 				}
// 			}
// 			return [hitPart, hitPos, hitNorm, hitMat]
// 		}
// 		return [undefined, undefined]
// 	}
// }

// export namespace HumanoidCaching {
// 	const humanoidCache = new Map<Player, Humanoid>()

// 	function findPlayerHumanoid(player: Player) {
// 		const character = player && player.Character
// 		if( character ){
// 			const resultHumanoid = humanoidCache.get(player);
// 			if( resultHumanoid && resultHumanoid.Parent === character ){
// 				return resultHumanoid
// 			}else{
// 				humanoidCache.delete(player) // Bust Old Cache
// 				const humanoid = character.FindFirstChildOfClass("Humanoid")
// 				if( humanoid )humanoidCache.set(player, humanoid)
// 				return humanoid
// 			}
// 		}
// 	}
// }

// //////////////////////////CHARACTER CONTROL//////////////////////////////-
// export namespace CharacterControl {
// 	let CurrentIgnoreList: Instance[] | undefined;
// 	let CurrentIgnoreTag: string | undefined
	
// 	let TaggedInstanceAddedConnection: RBXScriptConnection | undefined 
// 	let TaggedInstanceRemovedConnection: RBXScriptConnection | undefined 


// 	export function GetCharacter() {
// 		return Player && Player.Character;
// 	}

// 	export function UpdateIgnoreTag(newIgnoreTag: string) {
// 		if( newIgnoreTag === CurrentIgnoreTag )return
// 		TaggedInstanceAddedConnection?.Disconnect()
// 			TaggedInstanceAddedConnection = undefined
// 			TaggedInstanceRemovedConnection?.Disconnect()
// 			TaggedInstanceRemovedConnection = undefined
// 		CurrentIgnoreTag = newIgnoreTag
// 		CurrentIgnoreList = CharacterControl.GetCharacter() ? [CharacterControl.GetCharacter() as Model] : []

// 		if( CurrentIgnoreTag !== undefined ){
// 			const ignoreParts = CollectionService.GetTagged(CurrentIgnoreTag)

// 			CurrentIgnoreList.push(...ignoreParts);

// 			TaggedInstanceAddedConnection = CollectionService.GetInstanceAddedSignal(CurrentIgnoreTag).Connect(part => CurrentIgnoreList && CurrentIgnoreList.push(part));
// 			TaggedInstanceRemovedConnection = CollectionService.GetInstanceAddedSignal(CurrentIgnoreTag).Connect(part => CurrentIgnoreList && CurrentIgnoreList.remove(CurrentIgnoreList.indexOf(part)));
// 		}
// 	}

// 	export function getIgnoreList() {
// 		if (CurrentIgnoreList) return CurrentIgnoreList;

// 		CurrentIgnoreList = [];
// 		CurrentIgnoreList.push(CharacterControl.GetCharacter() as Model);

// 		return CurrentIgnoreList;
// 	}
	
// 	export function minV (a: Vector3, b: Vector3)  {
// 		return Vector3.new(math.min(a.X, b.X), math.min(a.Y, b.Y), math.min(a.Z, b.Z))
// 	}

// 	export function maxV (a: Vector3, b: Vector3)  {
// 		return Vector3.new(math.max(a.X, b.X), math.max(a.Y, b.Y), math.max(a.Z, b.Z))
// 	}
	
// 	export function getCollidableExtentsSize  (character: Model?)  {
// 		if( !character  || (!character.PrimaryPart )) return 

// 		const toLocalCFrame = character.PrimaryPart.CFrame.Inverse()

// 		let min = Vector3.new(math.huge, math.huge, math.huge)
// 		let max = Vector3.new(-math.huge, -math.huge, -math.huge)
		
// 		character.GetDescendants().forEach(descendant => {
// 			if( descendant.IsA('BasePart') && descendant.CanCollide ){
// 				const localCFrame = toLocalCFrame.mul(descendant.CFrame)
// 				const size = Vector3.new(descendant.Size.X / 2, descendant.Size.Y / 2, descendant.Size.Z / 2)
// 				const vertices = [
// 					Vector3.new( size.X,  size.Y,  size.Z),
// 					Vector3.new( size.X,  size.Y, -size.Z),
// 					Vector3.new( size.X, -size.Y,  size.Z),
// 					Vector3.new( size.X, -size.Y, -size.Z),
// 					Vector3.new(-size.X,  size.Y,  size.Z),
// 					Vector3.new(-size.X,  size.Y, -size.Z),
// 					Vector3.new(-size.X, -size.Y,  size.Z),
// 					Vector3.new(-size.X, -size.Y, -size.Z)
// 				]
// 				vertices.forEach(vertex => {
// 					const v = localCFrame.mul(vertex)
					
// 					min = minV(min, v.Position)
// 					max = maxV(max, v.Position)
// 				})
// 			}
// 		})

// 		const r = max.sub(min)

// 		return  r.X < 0 || r.Y < 0 || r.Z < 0 ? undefined : r;
// 	}
// }


// //////////////////////////////////-PATHER//////////////////////////////////////
// export class Pather {
// 	Cancelled = false
// 	Started = false

// 	Finished = Instance.new("BindableEvent")
// 	PathFailed = Instance.new("BindableEvent")

// 	PathComputing = false
// 	PathComputed = false

// 	OriginalTargetPoint: Vector3;
// 	TargetPoint: Vector3;
// 	TargetSurfaceNormal: Vector3;

// 	DiedConn: RBXScriptConnection | undefined
// 	SeatedConn: RBXScriptConnection | undefined
// 	BlockedConn : RBXScriptConnection | undefined
// 	TeleportedConn: RBXScriptConnection | undefined

// 	CurrentPoint = 0

// 	HumanoidOffsetFromPath = ZERO_VECTOR3

// 	CurrentWaypointPosition: Vector3 | undefined
// 	CurrentWaypointPlaneNormal = ZERO_VECTOR3
// 	CurrentWaypointPlaneDistance = 0
// 	CurrentWaypointNeedsJump = false;

// 	CurrentHumanoidPosition = ZERO_VECTOR3
// 	CurrentHumanoidVelocity: Vector3 | number = 0 

// 	NextActionMoveDirection = ZERO_VECTOR3
// 	NextActionJump = false

// 	Timeout = 0

// 	Humanoid: Humanoid = HumanoidCaching.findPlayerHumanoid(Player)
// 	OriginPoint: Vector3 | undefined
// 	AgentCanFollowPath = false
// 	DirectPath = false
// 	DirectPathRiseFirst = false

// 	stopTraverseFunc: (() => void) | undefined
// 	setPointFunc: ((point: number) => void) | undefined
// 	pointList: PathWaypoint[] | undefined

// 	private pathResult: Path | undefined;

// 	Recomputing = false;

// 	constructor(endPoint, surfaceNormal, overrideUseDirectPath?: boolean) {
// 		let directPathForHumanoid
// 		let directPathForVehicle

// 		if( overrideUseDirectPath !== undefined ){
// 			directPathForHumanoid = overrideUseDirectPath
// 			directPathForVehicle = overrideUseDirectPath
// 		}else{
// 			directPathForHumanoid = UseDirectPath
// 			directPathForVehicle = UseDirectPathForVehicle
// 		}

		
// 		this.OriginalTargetPoint = endPoint
// 		this.TargetPoint = endPoint
// 		this.TargetSurfaceNormal = surfaceNormal

// 		const rootPart: BasePart = this.Humanoid && this.Humanoid.RootPart
// 	if( rootPart ){
// 		// Setup origin
// 		this.OriginPoint = rootPart.CFrame.Position

// 		// Setup agent
// 		let agentRadius = 2
// 		let agentHeight = 5
// 		let agentCanJump = true

// 		const seat = this.Humanoid.SeatPart

// 		if( seat && seat.IsA("VehicleSeat") ){
// 			// Humanoid is seated on a vehicle
// 			const vehicle = seat.FindFirstAncestorOfClass("Model")
// 			if( vehicle ){
// 				// Make sure the PrimaryPart is set to the vehicle seat while we compute the extends.
// 				const tempPrimaryPart = vehicle.PrimaryPart
// 				vehicle.PrimaryPart = seat

// 				// For now, only direct path
// 				if( directPathForVehicle ){
// 					const extents: Vector3 = vehicle.GetExtentsSize()

// 					agentRadius = AgentSizeIncreaseFactor * 0.5 * math.sqrt(extents.X * extents.X + extents.Z * extents.Z)
// 					agentHeight = AgentSizeIncreaseFactor * extents.Y
// 					agentCanJump = false

// 					this.AgentCanFollowPath = true
// 					this.DirectPath = directPathForVehicle
// 				}

// 				// Reset PrimaryPart
// 				vehicle.PrimaryPart = tempPrimaryPart
// 			}
// 		}else{
// 			const character = CharacterControl.GetCharacter();

// 			assert(character);

// 			let extents: Vector3 | undefined

// 			if( FFlagUserExcludeNonCollidableForPathfinding)extents = CharacterControl.getCollidableExtentsSize(character)
// 			if (!extents) extents = character.GetExtentsSize();
			
// 			agentRadius = AgentSizeIncreaseFactor * 0.5 * math.sqrt(extents.X * extents.X + extents.Z * extents.Z)
// 			agentHeight = AgentSizeIncreaseFactor * extents.Y
// 			agentCanJump = (this.Humanoid.JumpPower > 0)

// 			this.AgentCanFollowPath = true
// 			this.DirectPath = directPathForHumanoid as boolean
// 			this.DirectPathRiseFirst = this.Humanoid.Sit
// 		}

// 		// Build path object
// 		if( FFlagUserClickToMoveSupportAgentCanClimb ){
// 			this.pathResult = PathfindingService.CreatePath({AgentRadius: agentRadius, AgentHeight : agentHeight, AgentCanJump : agentCanJump, AgentCanClimb = true})
// 		}else{
// 			this.pathResult = PathfindingService.CreatePath({AgentRadius:agentRadius, AgentHeight: agentHeight, AgentCanJump :agentCanJump})
// 		}
// 	}

// 	//We always raycast to the ground in the case that the user clicked a wall.
// 	const offsetPoint = this.TargetPoint.add(this.TargetSurfaceNormal.mul(1.5))
// 	if( FFlagUserRaycastPerformanceImprovements ){
// 		raycastParams.FilterDescendantsInstances =CharacterControl. getIgnoreList()
// 		const raycastResult = Workspace.Raycast(offsetPoint, Vector3.yAxis.mul(-50), raycastParams)
	
// 		if( raycastResult )	this.TargetPoint = raycastResult.Position
// 	}else{
// 		const ray = Ray.new(offsetPoint, Vector3.new(0,-1,0)*50)
// 		const [newHitPart, newHitPos] = Workspace.FindPartOnRayWithIgnoreList(ray, CharacterControl.getIgnoreList())
// 		if( newHitPart )this.TargetPoint = newHitPos
// 	}
// 	this.ComputePath()
// 	}

// 	Cleanup() {
// 		if( this.stopTraverseFunc ){
// 			this.stopTraverseFunc()
// 			this.stopTraverseFunc = undefined
// 		}

// 		if( this.BlockedConn ){
// 			this.BlockedConn.Disconnect()
// 			this.BlockedConn = undefined
// 		}

// 		if( this.DiedConn ){
// 			this.DiedConn.Disconnect()
// 			this.DiedConn = undefined
// 		}

// 		if( this.SeatedConn ){
// 			this.SeatedConn.Disconnect()
// 			this.SeatedConn = undefined
// 		}

// 		if( this.TeleportedConn ){
// 			this.TeleportedConn.Disconnect()
// 			this.TeleportedConn = undefined
// 		}

// 		this.Started = false
// 	}

// 	Cancel() {
// 		this.Cancelled = true
// 		this.Cleanup()
// 	}

// 	IsActive() {
// 		return this.AgentCanFollowPath && this.Started && !this.Cancelled
// 	}

// 	OnPathInterrupted() {
// 		// Stop moving
// 		this.Cancelled = true
// 		this.OnPointReached(false)
// 	}

// 	ComputePath() {
// 		if( this.OriginPoint ){
// 			if( this.PathComputed || this.PathComputing ){ return }
// 			this.PathComputing = true
// 			if( this.AgentCanFollowPath ){
// 				if( this.DirectPath ){
// 					this.pointList = [
// 						PathWaypoint.new(this.OriginPoint, Enum.PathWaypointAction.Walk),
// 						PathWaypoint.new(this.TargetPoint, this.DirectPathRiseFirst && Enum.PathWaypointAction.Jump || Enum.PathWaypointAction.Walk)
// 					]
// 					this.PathComputed = true
// 				}else{
// 					assert(this.pathResult);

// 					this.pathResult.ComputeAsync(this.OriginPoint, this.TargetPoint)
// 					this.pointList = this.pathResult.GetWaypoints()
// 					this.BlockedConn = this.pathResult.Blocked.Connect((blockedIdx: number) => this.OnPathBlocked(blockedIdx) )
// 					this.PathComputed = this.pathResult.Status === Enum.PathStatus.Success
// 				}
// 			}
// 			this.PathComputing = false
// 		}
// 	}

// 	IsValidPath() {
// 		this.ComputePath()
// 		return this.PathComputed && this.AgentCanFollowPath
// 	}

// 	OnPathBlocked(blockedWaypointIdx: number) {
// 		const pathBlocked = blockedWaypointIdx >= this.CurrentPoint
// 		if( ! pathBlocked || this.Recomputing )return

// 		this.Recomputing = true

// 		if( this.stopTraverseFunc ){
// 			this.stopTraverseFunc()
// 			this.stopTraverseFunc = undefined
// 		}

// 		assert(this.Humanoid)
// 		assert(this.Humanoid.RootPart)
// 		assert(this.pathResult)

// 		this.OriginPoint = this.Humanoid.RootPart.CFrame.Position

// 		this.pathResult.ComputeAsync(this.OriginPoint, this.TargetPoint)
// 		this.pointList = this.pathResult.GetWaypoints()
// 		if( #this.pointList > 0 )this.HumanoidOffsetFromPath = this.pointList[1].Position.sub( this.OriginPoint)
// 		this.PathComputed = this.pathResult.Status === Enum.PathStatus.Success

// 		if( ShowPath )[this.stopTraverseFunc, this.setPointFunc] = ClickToMoveDisplay.CreatePathDisplay(this.pointList)

// 		if( this.PathComputed ){
// 			this.CurrentPoint = 1 // The first waypoint is always the start location. Skip it.
// 			this.OnPointReached(true) // Move to first point
// 		}else{
// 			this.PathFailed.Fire()
// 			this.Cleanup()
// 		}

// 		this.Recomputing = false
// 	}

// 	OnRenderStepped(dt: number) {
// 		if( this.Started && ! this.Cancelled ){
// 			// Check for Timeout (if( a waypoint is ! reached within the delay, we fail)
// 			this.Timeout = this.Timeout + dt

// 			if( this.Timeout > UnreachableWaypointTimeout ){
// 				this.OnPointReached(false)

// 				return
// 			}

// 			assert(this.Humanoid)
// 			assert(this.Humanoid.RootPart)

// 			// Get Humanoid position && velocity
// 			this.CurrentHumanoidPosition = this.Humanoid.RootPart.Position + this.HumanoidOffsetFromPath
// 			this.CurrentHumanoidVelocity = this.Humanoid.RootPart.Velocity

// 			// Check if( it has reached some waypoints
// 			while (this.Started && this.IsCurrentWaypointReached()) this.OnPointReached(true)

// 			// if( still started, update actions
// 			if( this.Started ){
// 				// Move action
// 				this.NextActionMoveDirection = this.CurrentWaypointPosition?.sub(this.CurrentHumanoidPosition)

// 				if( this.NextActionMoveDirection.Magnitude > ALMOST_ZERO ){
// 					this.NextActionMoveDirection = this.NextActionMoveDirection.Unit
// 				}else{
// 					this.NextActionMoveDirection = ZERO_VECTOR3
// 				}
// 				// Jump action
// 				if( this.CurrentWaypointNeedsJump ){
// 					this.NextActionJump = true
// 					this.CurrentWaypointNeedsJump = false	// Request jump only once
// 				}else{
// 					this.NextActionJump = false
// 				}
// 			}
// 		}
// 	}

// 	IsCurrentWaypointReached() {
// 		let reached = false

// 		// Check we { have a plane, if( !, we consider the waypoint reached
// 		if( this.CurrentWaypointPlaneNormal !== ZERO_VECTOR3 ){
// 			// Compute distance of Humanoid from destination plane
// 			const dist = this.CurrentWaypointPlaneNormal.Dot(this.CurrentHumanoidPosition) - this.CurrentWaypointPlaneDistance
// 			// Compute the component of the Humanoid velocity that is towards the plane
// 			const velocity = -this.CurrentWaypointPlaneNormal.Dot(this.CurrentHumanoidVelocity)
// 			// Compute the threshold from the destination plane based on Humanoid velocity
// 			const threshold = math.max(1.0, 0.0625 * velocity)
// 			// if( we are less ){ threshold in front of the plane (between 0 && threshold) || if( we are behing the plane (less ){ 0), we consider we reached it
// 			reached = dist < threshold
// 		}else{
// 			reached = true
// 		}

// 		if( reached ){
// 			this.CurrentWaypointPosition = undefined
// 			this.CurrentWaypointPlaneNormal	= ZERO_VECTOR3
// 			this.CurrentWaypointPlaneDistance = 0
// 		}

// 		return reached
// 	}

// 	OnPointReached(reached: boolean) {
// 		if( reached && ! this.Cancelled ){
// 			// First, destroyed the current displayed waypoint
// 			if( this.setPointFunc )this.setPointFunc(this.CurrentPoint)

// 				assert(this.pointList)

// 			const nextWaypointIdx = this.CurrentPoint + 1

// 			if( nextWaypointIdx > #this.pointList ){
// 				// } of path reached
// 				if( this.stopTraverseFunc ){
// 					this.stopTraverseFunc()
// 				}
// 				this.Finished.Fire()
// 				this.Cleanup()
// 			}else{
// 				const currentWaypoint = this.pointList[this.CurrentPoint]
// 				const nextWaypoint = this.pointList[nextWaypointIdx]

// 				// if( airborne, only allow to keep moving
// 				// if( nextWaypoint.Action !== Jump, || path mantains a direction
// 				// Otherwise, wait until the humanoid gets to the ground
// 				const currentState = this.Humanoid.GetState()
// 				const isInAir = currentState === Enum.HumanoidStateType.FallingDown
// 					|| currentState === Enum.HumanoidStateType.Freefall
// 					|| currentState === Enum.HumanoidStateType.Jumping

// 				if( isInAir ){
// 					let shouldWaitForGround = nextWaypoint.Action === Enum.PathWaypointAction.Jump

// 					if( ! shouldWaitForGround && this.CurrentPoint > 1 ){
// 						const prevWaypoint = this.pointList[this.CurrentPoint - 1]

// 						const prevDir = currentWaypoint.Position.sub(prevWaypoint.Position)
// 						const currDir = nextWaypoint.Position.sub(currentWaypoint.Position)

// 						const prevDirXZ = Vector2.new(prevDir.X, prevDir.Z).Unit
// 						const currDirXZ = Vector2.new(currDir.X, currDir.Z).Unit

// 						const THRESHOLD_COS = 0.996 // ~cos(5 degrees)

// 						shouldWaitForGround = prevDirXZ.Dot(currDirXZ) < THRESHOLD_COS
// 					}

// 					if( shouldWaitForGround ){
// 						this.Humanoid.FreeFalling.Wait()

// 						// Give time to the humanoid's state to change
// 						// Otherwise, the jump flag in Humanoid
// 						// will be reset by the state change
// 						task.wait(0.1)
// 					}
// 				}

// 				// Move to the next point
// 				this.MoveToNextWayPoint(currentWaypoint, nextWaypoint, nextWaypointIdx)
// 			}
// 		}else{
// 			this.PathFailed.Fire()
// 			this.Cleanup()
// 		}
// 	}

// 	MoveToNextWayPoint(currentWaypoint: PathWaypoint, nextWaypoint: PathWaypoint, nextWaypointIdx: number) {
// 		// Build next destination plane
// 		// (plane normal is perpendicular to the y plane && is from next waypoint towards current one (provided the two waypoints are ! at the same location))
// 		// (plane location is at next waypoint)
// 		this.CurrentWaypointPlaneNormal = currentWaypoint.Position.sub(nextWaypoint.Position)
		
// 		// plane normal isn't perpendicular to the y plane when climbing up
// 		if( ! FFlagUserClickToMoveSupportAgentCanClimb || (nextWaypoint.Label !== "Climb") ){
// 			this.CurrentWaypointPlaneNormal = Vector3.new(this.CurrentWaypointPlaneNormal.X, 0, this.CurrentWaypointPlaneNormal.Z)
// 		}
// 		if( this.CurrentWaypointPlaneNormal.Magnitude > ALMOST_ZERO ){
// 			this.CurrentWaypointPlaneNormal	= this.CurrentWaypointPlaneNormal.Unit
// 			this.CurrentWaypointPlaneDistance = this.CurrentWaypointPlaneNormal.Dot(nextWaypoint.Position)
// 		}else{
// 			// Next waypoint is the same as current waypoint so no plane
// 			this.CurrentWaypointPlaneNormal	= ZERO_VECTOR3
// 			this.CurrentWaypointPlaneDistance = 0
// 		}

// 		// Should we jump
// 		this.CurrentWaypointNeedsJump = nextWaypoint.Action === Enum.PathWaypointAction.Jump;

// 		// Remember next waypoint position
// 		this.CurrentWaypointPosition = nextWaypoint.Position

// 		// Move to next point
// 		this.CurrentPoint = nextWaypointIdx

// 		// Finally reset Timeout
// 		this.Timeout = 0
// 	}

// 	Start(overrideShowPath: boolean) {
// 		if( ! this.AgentCanFollowPath ){
// 			this.PathFailed.Fire()
// 			return
// 		}

// 		if( this.Started )return
// 		this.Started = true

// 		ClickToMoveDisplay.CancelFailureAnimation()

// 		if( ShowPath ){
// 			if( overrideShowPath === undefined || overrideShowPath ){
// 				this.stopTraverseFunc, this.setPointFunc = ClickToMoveDisplay.CreatePathDisplay(this.pointList, this.OriginalTargetPoint)
// 			}
// 		}

// 		assert(this.pointList)
// 		assert(this.OriginPoint)
// 		assert(this.Humanoid)
// 		assert(this.Humanoid.RootPart)

// 		if( #this.pointList > 0 ){
// 			// Determine the humanoid offset from the path's first point
// 			// Offset of the first waypoint from the path's origin point
// 			this.HumanoidOffsetFromPath = Vector3.new(0, this.pointList[1].Position.Y - this.OriginPoint.Y, 0)

// 			// As well as its current position && velocity
// 			this.CurrentHumanoidPosition = this.Humanoid.RootPart.Position + this.HumanoidOffsetFromPath
// 			this.CurrentHumanoidVelocity = this.Humanoid.RootPart.Velocity

// 			// Connect to events
// 			this.SeatedConn = this.Humanoid.Seated.Connect((isSeated, seat)  => this.OnPathInterrupted() )
// 			this.DiedConn = this.Humanoid.Died.Connect(()  => this.OnPathInterrupted())
// 			this.TeleportedConn = this.Humanoid.RootPart.GetPropertyChangedSignal("CFrame").Connect(() =>  this.OnPathInterrupted())

// 			// Actually start
// 			this.CurrentPoint = 1 // The first waypoint is always the start location. Skip it.
// 			this.OnPointReached(true) // Move to first point
// 		}else{
// 			this.PathFailed.Fire()

// 			if( this.stopTraverseFunc )this.stopTraverseFunc()
// 		}
// 	}
// }

// ////////////////////////////////////////////////////////////////////////-

// const CheckAlive = () => {
// 	const humanoid = findPlayerHumanoid(Player)
// 	return humanoid !== undefined && humanoid.Health > 0
// }

// const GetEquippedTool = (character: Model?) => {
// 	if( character !== undefined ){
// 		for _, child in pairs(character.GetChildren()) {
// 			if( child.IsA('Tool') ){
// 				return child
// 			}
// 		}
// 	}
// }

// const ExistingPather = undefined
// const ExistingIndicator = undefined
// const PathCompleteListener = undefined
// const PathFailedListener = undefined

// const CleanupPath = () => {
// 	if( ExistingPather ){
// 		ExistingPather.Cancel()
// 		ExistingPather = undefined
// 	}
// 	if( PathCompleteListener ){
// 		PathCompleteListener.Disconnect()
// 		PathCompleteListener = undefined
// 	}
// 	if( PathFailedListener ){
// 		PathFailedListener.Disconnect()
// 		PathFailedListener = undefined
// 	}
// 	if( ExistingIndicator ){
// 		ExistingIndicator.Destroy()
// 	}
// }

// const HandleMoveTo = (thisPather, hitPt, hitChar, character, overrideShowPath) => {
// 	if( ExistingPather ){
// 		CleanupPath()
// 	}
// 	ExistingPather = thisPather
// 	thisPather.Start(overrideShowPath)

// 	PathCompleteListener = thisPather.Finished.Event.Connect(() => {
// 		CleanupPath()
// 		if( hitChar ){
// 			const currentWeapon = GetEquippedTool(character)
// 			if( currentWeapon ){
// 				currentWeapon.Activate()
// 			}
// 		}
// 	})
// 	PathFailedListener = thisPather.PathFailed.Event.Connect(() => {
// 		CleanupPath()
// 		if( overrideShowPath === undefined || overrideShowPath ){
// 			const shouldPlayFailureAnim = PlayFailureAnimation && ! (ExistingPather && ExistingPather.IsActive())
// 			if( shouldPlayFailureAnim ){
// 				ClickToMoveDisplay.PlayFailureAnimation()
// 			}
// 			ClickToMoveDisplay.DisplayFailureWaypoint(hitPt)
// 		}
// 	})
// }

// const ShowPathFailedFeedback = (hitPt) => {
// 	if( ExistingPather && ExistingPather.IsActive() ){
// 		ExistingPather.Cancel()
// 	}
// 	if( PlayFailureAnimation ){
// 		ClickToMoveDisplay.PlayFailureAnimation()
// 	}
// 	ClickToMoveDisplay.DisplayFailureWaypoint(hitPt)
// }

// function OnTap(tapPositions: {Vector3}, goToPoint: Vector3?, wasTouchTap: boolean?) {
// 	// Good to remember if( this is the latest tap event
// 	const camera = Workspace.CurrentCamera
// 	const character = Player.Character

// 	if( ! CheckAlive() ){ return }

// 	// This is a path tap position
// 	if( #tapPositions === 1 || goToPoint ){
// 		if( camera ){
// 			const unitRay = camera.ScreenPointToRay(tapPositions[1].X, tapPositions[1].Y)
			
// 			if( FFlagUserRaycastPerformanceImprovements ){
// 				const humanoidResult, characterResult, raycastResult
// 				const ignoreList = getIgnoreList() || {}
// 				do {
// 					const encounteredCollider = true
// 					raycastParams.FilterDescendantsInstances = ignoreList
// 					raycastResult = Workspace.Raycast(unitRay.Origin, unitRay.Direction * 1000, raycastParams)

// 					if( raycastResult ){
// 						const instance = raycastResult.Instance
// 						if( ! instance.CanCollide ){
// 							repeat
// 								humanoidResult = instance.FindFirstChildOfClass("Humanoid")

// 								characterResult = instance
// 								instance = instance.Parent
// 							until humanoidResult || ! instance || instance === Workspace

// 							if( ! humanoidResult ){
// 								characterResult = undefined
// 								encounteredCollider = false

// 								table.insert(ignoreList, instance)
// 							}
// 						}
// 					}
// 				until encounteredCollider

// 				if( wasTouchTap && humanoidResult && StarterGui.GetCore("AvatarContextMenuEnabled") ){
// 					const clickedPlayer = Players.GetPlayerFromCharacter(humanoidResult.Parent)
// 					if( clickedPlayer ){
// 						CleanupPath()
// 						return
// 					}
// 				}

// 				if( ! raycastResult || ! character ){
// 					return
// 				}

// 				const position = raycastResult.Position
// 				if( goToPoint ){ 
// 					position = goToPoint
// 					characterResult = undefined
// 				}
// 					// Clean up current path
// 				CleanupPath()
// 				const thisPather = Pather(position, raycastResult.Normal)
// 				if( thisPather.IsValidPath() ){
// 					HandleMoveTo(thisPather, position, characterResult, character)
// 				}else{
// 					// Clean up
// 					thisPather.Cleanup()
// 					// Feedback here for when we don't have a good path
// 					ShowPathFailedFeedback(position)
// 				}
// 			}else{
// 				const ray = Ray.new(unitRay.Origin, unitRay.Direction*1000)
// 				const hitPart, hitPt, hitNormal = Utility.Raycast(ray, true, getIgnoreList())

// 				const hitChar, hitHumanoid = Utility.FindCharacterAncestor(hitPart)
// 				if( wasTouchTap && hitHumanoid && StarterGui.GetCore("AvatarContextMenuEnabled") ){
// 					const clickedPlayer = Players.GetPlayerFromCharacter(hitHumanoid.Parent)
// 					if( clickedPlayer ){
// 						CleanupPath()
// 						return
// 					}
// 				}
// 				if( goToPoint ){
// 					hitPt = goToPoint
// 					hitChar = undefined
// 				}
// 				if( hitPt && character ){
// 					// Clean up current path
// 					CleanupPath()
// 					const thisPather = Pather(hitPt, hitNormal)
// 					if( thisPather.IsValidPath() ){
// 						HandleMoveTo(thisPather, hitPt, hitChar, character)
// 					}else{
// 						// Clean up
// 						thisPather.Cleanup()
// 						// Feedback here for when we don't have a good path
// 						ShowPathFailedFeedback(hitPt)
// 					}
// 				}
// 			}
// 		}
// 	} else if ( #tapPositions >= 2 ){
// 		if( camera ){
// 			// { shoot
// 			const currentWeapon = GetEquippedTool(character)
// 			if( currentWeapon )currentWeapon.Activate()
// 		}
// 	}
// }

// const DisconnectEvent = (event) => {
// 	if( event ){
// 		event.Disconnect()
// 	}
// }

// //[[ The ClickToMove Controller Class ]]//
// const KeyboardController = require(script.Parent.WaitForChild("Keyboard"))
// const ClickToMove = setmetatable({}, KeyboardController)
// ClickToMove.__index = ClickToMove

// export class ClickToMove extends KeyboardController {
// constructor(CONTROL_ACTION_PRIORITY) {
// super(CONTROL_ACTION_PRIORITY);
// 	const this = setmetatable(KeyboardController.new(CONTROL_ACTION_PRIORITY), ClickToMove)

// 	this.fingerTouches = {}
// 	this.numUnsunkTouches = 0
// 	// PC simulation
// 	this.mouse1Down = tick()
// 	this.mouse1DownPos = Vector2.new()
// 	this.mouse2DownTime = tick()
// 	this.mouse2DownPos = Vector2.new()
// 	this.mouse2UpTime = tick()

// 	this.keyboardMoveVector = ZERO_VECTOR3

// 	this.tapConn = undefined
// 	this.inputBeganConn = undefined
// 	this.inputChangedConn = undefined
// 	this.inputEndedConn = undefined
// 	this.humanoidDiedConn = undefined
// 	this.characterChildAddedConn = undefined
// 	this.onCharacterAddedConn = undefined
// 	this.characterChildRemovedConn = undefined
// 	this.renderSteppedConn = undefined
// 	this.menuOpenedConnection = undefined

// 	this.running = false

// 	this.wasdEnabled = false

// 	return this
// }

// DisconnectEvents() {
// 	DisconnectEvent(this.tapConn)
// 	DisconnectEvent(this.inputBeganConn)
// 	DisconnectEvent(this.inputChangedConn)
// 	DisconnectEvent(this.inputEndedConn)
// 	DisconnectEvent(this.humanoidDiedConn)
// 	DisconnectEvent(this.characterChildAddedConn)
// 	DisconnectEvent(this.onCharacterAddedConn)
// 	DisconnectEvent(this.renderSteppedConn)
// 	DisconnectEvent(this.characterChildRemovedConn)
// 	DisconnectEvent(this.menuOpenedConnection)
// }

// OnTouchBegan(input, processed) {
// 	if( this.fingerTouches[input] === undefined && ! processed ){
// 		this.numUnsunkTouches = this.numUnsunkTouches + 1
// 	}
// 	this.fingerTouches[input] = processed
// }

// OnTouchChanged(input, processed) {
// 	if( this.fingerTouches[input] === undefined ){
// 		this.fingerTouches[input] = processed
// 		if( ! processed ){
// 			this.numUnsunkTouches = this.numUnsunkTouches + 1
// 		}
// 	}
// }

// OnTouchEnded(input, processed) {
// 	if( this.fingerTouches[input] !== undefined && this.fingerTouches[input] === false ){
// 		this.numUnsunkTouches = this.numUnsunkTouches - 1
// 	}
// 	this.fingerTouches[input] = undefined
// }


// OnCharacterAdded(character) {
// 	this.DisconnectEvents()

// 	this.inputBeganConn = UserInputService.InputBegan.Connect((input, processed) => {
// 		if( input.UserInputType === Enum.UserInputType.Touch ){
// 			this.OnTouchBegan(input, processed)
// 		}

// 		// Cancel path when you use the keyboard controls if( wasd is enabled.
// 		if( this.wasdEnabled && processed === false && input.UserInputType === Enum.UserInputType.Keyboard
// 			&& movementKeys[input.KeyCode] ){
// 			CleanupPath()
// 			ClickToMoveDisplay.CancelFailureAnimation()
// 		}
// 		if( input.UserInputType === Enum.UserInputType.MouseButton1 ){
// 			this.mouse1DownTime = tick()
// 			this.mouse1DownPos = input.Position
// 		}
// 		if( input.UserInputType === Enum.UserInputType.MouseButton2 ){
// 			this.mouse2DownTime = tick()
// 			this.mouse2DownPos = input.Position
// 		}
// 	})

// 	this.inputChangedConn = UserInputService.InputChanged.Connect((input, processed) => {
// 		if( input.UserInputType === Enum.UserInputType.Touch ){
// 			this.OnTouchChanged(input, processed)
// 		}
// 	})

// 	this.inputEndedConn = UserInputService.InputEnded.Connect((input, processed) => {
// 		if( input.UserInputType === Enum.UserInputType.Touch ){
// 			this.OnTouchEnded(input, processed)
// 		}

// 		if( input.UserInputType === Enum.UserInputType.MouseButton2 ){
// 			this.mouse2UpTime = tick()
// 			const currPos: Vector3 = input.Position
// 			// We allow click to move during path following || if( there is no keyboard movement
// 			const allowed = ExistingPather || this.keyboardMoveVector.Magnitude <= 0
// 			if( this.mouse2UpTime - this.mouse2DownTime < 0.25 && (currPos - this.mouse2DownPos).magnitude < 5 && allowed ){
// 				const positions = {currPos}
// 				OnTap(positions)
// 			}
// 		}
// 	})

// 	this.tapConn = UserInputService.TouchTap.Connect((touchPositions, processed) => {
// 		if( ! processed ){
// 			OnTap(touchPositions, undefined, true)
// 		}
// 	})

// 	this.menuOpenedConnection = GuiService.MenuOpened.Connect(() => {
// 		CleanupPath()
// 	})

// 	const OnCharacterChildAdded = (child) => {
// 		if( UserInputService.TouchEnabled ){
// 			if( child.IsA('Tool') ){
// 				child.ManualActivationOnly = true
// 			}
// 		}
// 		if( child.IsA('Humanoid') ){
// 			DisconnectEvent(this.humanoidDiedConn)
// 			this.humanoidDiedConn = child.Died.Connect(() => {
// 				if( ExistingIndicator ){
// 					DebrisService.AddItem(ExistingIndicator.Model, 1)
// 				}
// 			})
// 		}
// 	}

// 	this.characterChildAddedConn = character.ChildAdded.Connect((child) => {
// 		OnCharacterChildAdded(child)
// 	})
// 	this.characterChildRemovedConn = character.ChildRemoved.Connect((child) => {
// 		if( UserInputService.TouchEnabled ){
// 			if( child.IsA('Tool') ){
// 				child.ManualActivationOnly = false
// 			}
// 		}
// 	})
// 	for _, child in pairs(character.GetChildren()) {
// 		OnCharacterChildAdded(child)
// 	}
// }

// Start() {
// 	this.Enable(true)
// }

// Stop() {
// 	this.Enable(false)
// }

// CleanupPath() {
// 	CleanupPath()
// }

// Enable(enable: boolean, enableWASD: boolean, touchJumpController) {
// 	if( enable ){
// 		if( ! this.running ){
// 			if( Player.Character ){ // retro-listen
// 				this.OnCharacterAdded(Player.Character)
// 			}
// 			this.onCharacterAddedConn = Player.CharacterAdded.Connect((char) => {
// 				this.OnCharacterAdded(char)
// 			})
// 			this.running = true
// 		}
// 		this.touchJumpController = touchJumpController
// 		if( this.touchJumpController ){
// 			this.touchJumpController.Enable(this.jumpEnabled)
// 		}
// 	}else{
// 		if( this.running ){
// 			this.DisconnectEvents()
// 			CleanupPath()
// 			// Restore tool activation on shutdown
// 			if( UserInputService.TouchEnabled ){
// 				const character = Player.Character
// 				if( character ){
// 					for _, child in pairs(character.GetChildren()) {
// 						if( child.IsA('Tool') ){
// 							child.ManualActivationOnly = false
// 						}
// 					}
// 				}
// 			}
// 			this.running = false
// 		}
// 		if( this.touchJumpController && ! this.jumpEnabled ){
// 			this.touchJumpController.Enable(true)
// 		}
// 		this.touchJumpController = undefined
// 	}

// 	// Extension for initializing Keyboard input as this class now derives from Keyboard
// 	KeyboardController.Enable(this, enable)

// 	this.wasdEnabled = enable && enableWASD || false
// 	this.enabled = enable
// }

// OnRenderStepped(dt) {
// 	// Reset jump
// 	this.isJumping = false

// 	// Handle Pather
// 	if( ExistingPather ){
// 		// Let the Pather update
// 		ExistingPather.OnRenderStepped(dt)

// 		// if( we still have a Pather, set the resulting actions
// 		if( ExistingPather ){
// 			// Setup move (! relative to camera)
// 			this.moveVector = ExistingPather.NextActionMoveDirection
// 			this.moveVectorIsCameraRelative = false

// 			// Setup jump (but { ! prevent the base Keayboard class from requesting jumps as well)
// 			if( ExistingPather.NextActionJump ){
// 				this.isJumping = true
// 			}
// 		}else{
// 			this.moveVector = this.keyboardMoveVector
// 			this.moveVectorIsCameraRelative = true
// 		}
// 	}else{
// 		this.moveVector = this.keyboardMoveVector
// 		this.moveVectorIsCameraRelative = true
// 	}

// 	// Handle Keyboard's jump
// 	if( this.jumpRequested ){
// 		this.isJumping = true
// 	}
// }

// // Overrides Keyboard.UpdateMovement(inputState) to conditionally consider this.wasdEnabled && let OnRenderStepped handle the movement
// UpdateMovement(inputState) {
// 	if( inputState === Enum.UserInputState.Cancel ){
// 		this.keyboardMoveVector = ZERO_VECTOR3
// 	} else if ( this.wasdEnabled ){
// 		this.keyboardMoveVector = Vector3.new(this.leftValue + this.rightValue, 0, this.forwardValue + this.backwardValue)
// 	}
// }

// // Overrides Keyboard.UpdateJump() because jump is handled in OnRenderStepped
// UpdateJump() {
// 	// Nothing to { (handled in OnRenderStepped)
// }

// //Public developer facing functions
// SetShowPath(value) {
// 	ShowPath = value
// }
//  {
// GetShowPath() {
// 	return ShowPath
// }

// SetWaypointTexture(texture) {
// 	ClickToMoveDisplay.SetWaypointTexture(texture)
// }

// GetWaypointTexture() {
// 	return ClickToMoveDisplay.GetWaypointTexture()
// }

// SetWaypointRadius(radius) {
// 	ClickToMoveDisplay.SetWaypointRadius(radius)
// }

// GetWaypointRadius() {
// 	return ClickToMoveDisplay.GetWaypointRadius()
// }

// SetEndWaypointTexture(texture) {
// 	ClickToMoveDisplay.SetEndWaypointTexture(texture)
// }

// GetEndWaypointTexture() {
// 	return ClickToMoveDisplay.GetEndWaypointTexture()
// }

// SetWaypointsAlwaysOnTop(alwaysOnTop) {
// 	ClickToMoveDisplay.SetWaypointsAlwaysOnTop(alwaysOnTop)
// }

// GetWaypointsAlwaysOnTop() {
// 	return ClickToMoveDisplay.GetWaypointsAlwaysOnTop()
// }

// SetFailureAnimationEnabled(enabled) {
// 	PlayFailureAnimation = enabled
// }

// GetFailureAnimationEnabled() {
// 	return PlayFailureAnimation
// }

// SetIgnoredPartsTag(tag) {
// 	UpdateIgnoreTag(tag)
// }

// GetIgnoredPartsTag() {
// 	return CurrentIgnoreTag
// }

// SetUseDirectPath(directPath) {
// 	UseDirectPath = directPath
// }

// GetUseDirectPath() {
// 	return UseDirectPath
// }

// SetAgentSizeIncreaseFactor(increaseFactorPercent: number) {
// 	AgentSizeIncreaseFactor = 1.0 + (increaseFactorPercent / 100.0)
// }

// GetAgentSizeIncreaseFactor() {
// 	return (AgentSizeIncreaseFactor - 1.0) * 100.0
// }

// SetUnreachableWaypointTimeout(timeoutInSec) {
// 	UnreachableWaypointTimeout = timeoutInSec
// }

// GetUnreachableWaypointTimeout() {
// 	return UnreachableWaypointTimeout
// }

// SetUserJumpEnabled(jumpEnabled) {
// 	this.jumpEnabled = jumpEnabled
// 	if( this.touchJumpController ){
// 		this.touchJumpController.Enable(jumpEnabled)
// 	}
// }

// GetUserJumpEnabled() {
// 	return this.jumpEnabled
// }

// MoveTo(position, showPath, useDirectPath) {
// 	const character = Player.Character
// 	if( character === undefined ){
// 		return false
// 	}
// 	const thisPather = Pather(position, Vector3.new(0, 1, 0), useDirectPath)
// 	if( thisPather && thisPather.IsValidPath() ){
// 		HandleMoveTo(thisPather, position, undefined, character, showPath)
// 		return true
// 	}
// 	return false
// }

// return ClickToMove
