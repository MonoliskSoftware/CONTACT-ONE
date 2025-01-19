import { Players, RunService } from "@rbxts/services";
import { Popper } from "./Popper";
import { Extrapolation } from "./Poppercam";

class ConstrainedSpring {
	freq: number;
	x: number;
	minValue: number;
	maxValue: number;
	goal: number;
	v = 0;

	constructor(freq: number, x: number, minValue: number, maxValue: number) {
		x = math.clamp(x, minValue, maxValue);

		this.freq = freq;
		this.x = x;
		this.minValue = minValue;
		this.maxValue = maxValue;
		this.goal = x;
	}

	Step(dt: number) {
		const freq = this.freq * 2 * math.pi; // Convert from Hz to rad/s
		const x: number = this.x;
		const v: number = this.v;
		const minValue: number = this.minValue;
		const maxValue: number = this.maxValue;
		const goal: number = this.goal;

		// Solve the spring ODE for position and velocity after time t, assuming critical damping:
		//   2*f*x'[t] + x''[t] = f^2*(g - x[t])
		// Knowns are x[0] and x'[0].
		// Solve for x[t] and x'[t].

		const offset = goal - x;
		const step = freq * dt;
		const decay = math.exp(-step);

		let x1 = goal + (v * dt - offset * (step + 1)) * decay;
		let v1 = ((offset * freq - v) * step + v) * decay;

		// Constrain
		if (x1 < minValue) {
			x1 = minValue;
			v1 = 0;
		} else if (x1 > maxValue) {
			x1 = maxValue;
			v1 = 0;
		}

		this.x = x1;
		this.v = v1;

		return x1;
	}
}

let cameraMinZoomDistance = 0;
let cameraMaxZoomDistance = 0;

if (RunService.IsClient()) {
	const Player = Players.LocalPlayer;

	const updateBounds = () => {
		cameraMinZoomDistance = Player.CameraMinZoomDistance;
		cameraMaxZoomDistance = Player.CameraMaxZoomDistance;
	};

	updateBounds();

	Player.GetPropertyChangedSignal("CameraMinZoomDistance").Connect(updateBounds);
	Player.GetPropertyChangedSignal("CameraMaxZoomDistance").Connect(updateBounds);
}

const ZOOM_STIFFNESS = 4.5;
const ZOOM_DEFAULT = 12.5;
const ZOOM_ACCELERATION = 0.0375;

const MIN_FOCUS_DIST = 0.5;
const DIST_OPAQUE = 1;

function stepTargetZoom(z: number, dz: number, zoomMin: number, zoomMax: number) {
	z = math.clamp(z + dz * (1 + z * ZOOM_ACCELERATION), zoomMin, zoomMax);

	if (z < DIST_OPAQUE) {
		z = dz <= 0 ? zoomMin : DIST_OPAQUE;
	}

	return z;
}

let zoomDelta = 0;

export class ZoomController {
	public static readonly singleton = new ZoomController();
	private zoomSpring = RunService.IsClient() ? new ConstrainedSpring(ZOOM_STIFFNESS, ZOOM_DEFAULT, MIN_FOCUS_DIST, cameraMaxZoomDistance) : undefined as unknown as ConstrainedSpring;

	constructor() {
		if (RunService.IsServer()) return undefined as unknown as ZoomController;
	}

	Update(renderDt: number, focus: CFrame, extrapolation: Extrapolation) {
		let poppedZoom = math.huge;

		if (this.zoomSpring.goal > DIST_OPAQUE) {
			// Make a pessimistic estimate of zoom distance for this step without accounting for poppercam
			const maxPossibleZoom = math.max(
				this.zoomSpring.x,
				stepTargetZoom(this.zoomSpring.goal, zoomDelta, cameraMinZoomDistance, cameraMaxZoomDistance)
			);

			// Run the Popper algorithm on the feasible zoom range, [MIN_FOCUS_DIST, maxPossibleZoom]
			poppedZoom = Popper(
				focus.mul(new CFrame(0, 0, MIN_FOCUS_DIST)),
				maxPossibleZoom - MIN_FOCUS_DIST,
				extrapolation
			) + MIN_FOCUS_DIST;
		}

		this.zoomSpring.minValue = MIN_FOCUS_DIST;
		this.zoomSpring.maxValue = math.min(cameraMaxZoomDistance, poppedZoom);

		return this.zoomSpring.Step(renderDt);
	}

	GetZoomRadius() {
		return this.zoomSpring.x;
	}

	SetZoomParameters(targetZoom: number, newZoomDelta: number) {
		this.zoomSpring.goal = targetZoom;
		zoomDelta = newZoomDelta;
	}

	ReleaseSpring() {
		this.zoomSpring.x = this.zoomSpring.goal;
		this.zoomSpring.v = 0;
	}
}