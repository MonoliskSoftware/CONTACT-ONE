import { Players, Workspace } from "@rbxts/services";
import { FlagUtil } from "../FlagUtil";
import { Extrapolation } from "./Poppercam";

const camera = Workspace.CurrentCamera;

// Flags
const FFlagUserRaycastPerformanceImprovements = FlagUtil.getUserFlag("UserRaycastPerformanceImprovements");

const excludeParams = new RaycastParams();
excludeParams.IgnoreWater = true;
excludeParams.FilterType = Enum.RaycastFilterType.Exclude;

const includeParams = new RaycastParams();
includeParams.IgnoreWater = true;
includeParams.FilterType = Enum.RaycastFilterType.Include;

function getTotalTransparency(part: BasePart) {
	return 1 - (1 - part.Transparency) * (1 - part.LocalTransparencyModifier);
}

function eraseFromEnd(t: defined[], toSize: number) {
	for (let i = t.size() - 1; i >= toSize; i--) {
		t[i] = undefined as unknown as defined;
	}
}

let nearPlaneZ = 0;
let projX = 0;
let projY = 0;

assert(camera);

function updateProjection() {
	assert(camera);

	const fov = math.rad(camera.FieldOfView);
	const view = camera.ViewportSize;
	const ar = view.X / view.Y;

	projY = 2 * math.tan(fov / 2);
	projX = ar * projY;
}

camera.GetPropertyChangedSignal("FieldOfView").Connect(updateProjection);
camera.GetPropertyChangedSignal("ViewportSize").Connect(updateProjection);

updateProjection();

nearPlaneZ = camera.NearPlaneZ;
camera.GetPropertyChangedSignal("NearPlaneZ").Connect(() => nearPlaneZ = camera.NearPlaneZ);

const excludeList: Instance[] = [];

const charMap = new Map<Player, Model>();

function refreshIgnoreList() {
	excludeList.clear();
	charMap.forEach(character => excludeList.push(character));
}

function characterAdded(player: Player, character: Model) {
	charMap.set(player, character);
	refreshIgnoreList();
}
function characterRemoving(player: Player) {
	charMap.delete(player);

	refreshIgnoreList();
}

function playerAdded(player: Player) {
	player.CharacterAdded.Connect(character => characterAdded(player, character));
	player.CharacterRemoving.Connect(() => characterRemoving(player));

	if (player.Character) {
		characterAdded(player, player.Character);
	}
}

function playerRemoving(player: Player) {
	charMap.delete(player);

	refreshIgnoreList();
}

Players.PlayerAdded.Connect(playerAdded);
Players.PlayerRemoving.Connect(playerRemoving);

Players.GetPlayers().forEach(playerAdded);

refreshIgnoreList();

////////////////////////////////////////////////////////////////////////////////////////////
// Popper uses the level geometry find an upper bound on subject-to-camera distance.
//
// Hard limits are applied immediately and unconditionally. They are generally caused
// when level geometry intersects with the near plane (with exceptions, see below).
//
// Soft limits are only applied under certain conditions.
// They are caused when level geometry occludes the subject without actually intersecting
// with the near plane at the target distance.
//
// Soft limits can be promoted to hard limits and hard limits can be demoted to soft limits.
// We usually don"t want the latter to happen.
//
// A soft limit will be promoted to a hard limit if an obstruction
// lies between the current and target camera positions.
////////////////////////////////////////////////////////////////////////////////////////////

let subjectRoot: Instance | undefined;
let subjectPart: Instance | undefined;

camera.GetPropertyChangedSignal("CameraSubject").Connect(() => {
	const subject = camera.CameraSubject;

	if (subject && subject.IsA("Humanoid")) {
		subjectPart = subject.RootPart;
	} else if (subject && subject.IsA("BasePart")) {
		subjectPart = subject;
	} else {
		subjectPart = undefined;
	}
});

function canOcclude(part: BasePart) {
	// Occluders must be:
	// 1. Opaque
	// 2. Interactable
	// 3. Not in the same assembly as the subject

	return getTotalTransparency(part) < 0.25 &&
		part.CanCollide &&
		subjectRoot !== (part.GetRootPart() || part) &&
		!part.IsA("TrussPart");
}

// Offsets for the volume visibility test
const SCAN_SAMPLE_OFFSETS = [
	new Vector2(0.4, 0.0),
	new Vector2(-0.4, 0.0),
	new Vector2(0.0, -0.4),
	new Vector2(0.0, 0.4),
	new Vector2(0.0, 0.2),
];

// Maximum number of rays that can be cast 
const QUERY_POINT_CAST_LIMIT = 64;

////////////////////////////////////////////////////////////////////////////////
// Piercing raycasts
function getCollisionPoint(origin: Vector3, dir: Vector3) {
	if (FFlagUserRaycastPerformanceImprovements) {
		excludeParams.FilterDescendantsInstances = excludeList;

		let raycastResult;

		do {
			raycastResult = Workspace.Raycast(origin, dir, excludeParams);

			if (raycastResult) {
				if (raycastResult.Instance.CanCollide) return $tuple(raycastResult.Position, true);

				excludeParams.AddToFilter(raycastResult.Instance);
			}
		} while (raycastResult);
	} else {
		const originalSize = excludeList.size();

		let hitPart: BasePart | undefined = undefined;
		let hitPoint: Vector3 | undefined = undefined;

		do {
			[hitPart, hitPoint] = Workspace.FindPartOnRayWithIgnoreList(
				new Ray(origin, dir), excludeList, false, true
			);

			if (hitPart) {
				if (hitPart.CanCollide) {
					eraseFromEnd(excludeList, originalSize);

					return $tuple(hitPoint, true);
				}

				excludeList.push(hitPart);
			}
		} while (hitPart);

		eraseFromEnd(excludeList, originalSize);
	}

	return $tuple(origin.add(dir), false);
}

////////////////////////////////////////////////////////////////////////////////

function queryPoint(origin: Vector3, unitDir: Vector3, dist: number, lastPos?: Vector3) {
	debug.profilebegin("queryPoint");

	const originalSize = excludeList.size();

	dist = dist + nearPlaneZ;
	const target = origin.add(unitDir.mul(dist));

	let softLimit = math.huge;
	let hardLimit = math.huge;
	let movingOrigin = origin;

	let numPierced = 0;

	if (FFlagUserRaycastPerformanceImprovements) {
		let entryInstance: BasePart | undefined = undefined, entryPosition: Vector3;

		do {
			excludeParams.FilterDescendantsInstances = excludeList;

			const enterRaycastResult = Workspace.Raycast(movingOrigin, target.sub(movingOrigin), excludeParams);

			if (enterRaycastResult) {
				[entryInstance, entryPosition] = [enterRaycastResult.Instance, enterRaycastResult.Position] as [BasePart, Vector3];
				numPierced += 1;

				const earlyAbort = numPierced >= QUERY_POINT_CAST_LIMIT;

				if (canOcclude(entryInstance) || earlyAbort) {
					const includeList = [entryInstance];

					includeParams.FilterDescendantsInstances = includeList;

					const exitRaycastResult = Workspace.Raycast(target, entryPosition.sub(target), includeParams);

					const lim = (entryPosition.sub(origin)).Magnitude;

					if (exitRaycastResult && !earlyAbort) {
						const promote = lastPos &&
							(Workspace.Raycast(lastPos, target.sub(lastPos), includeParams) ??
								Workspace.Raycast(target, lastPos.sub(target), includeParams));

						if (promote) {
							// Ostensibly a soft limit, but the camera has passed through it in the last frame, so promote to a hard limit.
							hardLimit = lim;
						} else if (dist < softLimit) {
							// Trivial soft limit
							softLimit = lim;
						}
					} else {
						// Trivial hard limit
						hardLimit = lim;
					}
				}

				excludeParams.AddToFilter(entryInstance);
				movingOrigin = entryPosition.sub((unitDir.mul(1e-3)));
			}
		} while (hardLimit >= math.huge && entryInstance !== undefined);
	} else {
		let entryPart: BasePart | undefined;
		let entryPos: Vector3 | undefined;

		do {
			[entryPart, entryPos] = Workspace.FindPartOnRayWithIgnoreList(new Ray(movingOrigin, target.sub(movingOrigin)), excludeList, false, true);

			numPierced += 1;

			if (entryPart) {
				// forces the current iteration into a hard limit to cap the number of raycasts
				const earlyAbort = numPierced >= QUERY_POINT_CAST_LIMIT;

				if (canOcclude(entryPart) || earlyAbort) {
					const wl = [entryPart];
					const [exitPart] = Workspace.FindPartOnRayWithWhitelist(new Ray(target, entryPos.sub(target)), wl, true);

					const lim = entryPos.sub(origin).Magnitude;

					if (exitPart && !earlyAbort) {
						let promote = false;

						if (lastPos) {
							promote = (Workspace.FindPartOnRayWithWhitelist(new Ray(lastPos, target.sub(lastPos)), wl, true)[0] ??
								Workspace.FindPartOnRayWithWhitelist(new Ray(target, lastPos.sub(target)), wl, true)[0]) !== undefined;
						}

						if (promote) {
							// Ostensibly a soft limit, but the camera has passed through it in the last frame, so promote to a hard limit.
							hardLimit = lim;
						} else if (dist < softLimit) {
							// Trivial soft limit
							softLimit = lim;
						}
					} else {
						// Trivial hard limit
						hardLimit = lim;
					}
				}

				excludeList.push(entryPart);
				movingOrigin = entryPos.sub(unitDir.mul(1e-3));
			}
		} while (hardLimit >= math.huge && entryPart);

		eraseFromEnd(excludeList, originalSize);
	}

	debug.profileend();
	return $tuple(softLimit - nearPlaneZ, hardLimit - nearPlaneZ);
}

function queryViewport(focus: CFrame, dist: number) {
	assert(camera);

	debug.profilebegin("queryViewport");

	const fP = focus.Position;
	const fX = focus.RightVector;
	const fY = focus.UpVector;
	const fZ = focus.LookVector.mul(-1);

	const viewport = camera.ViewportSize;

	let hardBoxLimit = math.huge;
	let softBoxLimit = math.huge;

	// Center the viewport on the PoI, sweep points on the edge towards the target, and take the minimum limits
	for (let viewX = 0; viewX <= 1; viewX++) {
		const worldX = fX.mul(((viewX - 0.5) * projX));

		for (let viewY = 0; viewY <= 1; viewY++) {
			const worldY = fY.mul(((viewY - 0.5) * projY));

			const origin = fP.add(worldX.add(worldY).mul(nearPlaneZ));

			const lastPos = camera.ViewportPointToRay(
				viewport.X * viewX,
				viewport.Y * viewY
			).Origin;

			const [softPointLimit, hardPointLimit] = queryPoint(origin, fZ, dist, lastPos);

			if (hardPointLimit < hardBoxLimit) {
				hardBoxLimit = hardPointLimit;
			}
			if (softPointLimit < softBoxLimit) {
				softBoxLimit = softPointLimit;
			}
		}
	}

	debug.profileend();

	return $tuple(softBoxLimit, hardBoxLimit);
}

function testPromotion(focus: CFrame, dist: number, focusExtrapolation: Extrapolation) {
	debug.profilebegin("testPromotion");

	const fP = focus.Position;
	const fX = focus.RightVector;
	const fY = focus.UpVector;
	const fZ = focus.LookVector.mul(-1);

	{
		// Dead reckoning the camera rotation and focus
		debug.profilebegin("extrapolate");

		const SAMPLE_DT = 0.0625;
		const SAMPLE_MAX_T = 1.25;

		const maxDist = (getCollisionPoint(fP, focusExtrapolation.posVelocity.mul(SAMPLE_MAX_T))[0].sub(fP)).Magnitude;
		// Metric that decides how many samples to take
		const combinedSpeed = focusExtrapolation.posVelocity.Magnitude;

		for (let dt = 0; dt <= math.min(SAMPLE_MAX_T, focusExtrapolation.rotVelocity.Magnitude + maxDist / combinedSpeed); dt += SAMPLE_DT) {
			const cfDt = focusExtrapolation.extrapolate(dt); // Extrapolated CFrame at time dt

			if (queryPoint(cfDt.Position, cfDt.LookVector.mul(-1), dist)[0] >= dist)
				return false;
		}
	}

	debug.profileend();

	{
		// Test screen-space offsets from the focus for the presence of soft limits
		debug.profilebegin("testOffsets");

		if (SCAN_SAMPLE_OFFSETS.some(offset => {
			const scaledOffset = offset;
			const [pos] = getCollisionPoint(fP, fX.mul(scaledOffset.X).add(fY.mul(scaledOffset.Y)));

			return queryPoint(pos, (fP.add(fZ.mul(dist)).sub(pos)).Unit, dist)[0] === math.huge;
		})) return false;

		debug.profileend();
	}

	debug.profileend();
	return true;
}

export function Popper(focus: CFrame, targetDist: number, focusExtrapolation: Extrapolation) {
	debug.profilebegin("popper");

	subjectRoot = subjectPart ? (subjectPart as BasePart).GetRootPart() : subjectPart;

	let dist = targetDist;
	const [soft, hard] = queryViewport(focus, targetDist);

	if (hard < dist) {
		dist = hard;
	}
	if (soft < dist && testPromotion(focus, targetDist, focusExtrapolation)) {
		dist = soft;
	}

	subjectRoot = undefined;

	debug.profileend();
	return dist;
}