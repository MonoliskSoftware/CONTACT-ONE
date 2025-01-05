import { FlagUtil } from "../FlagUtil";
import { BaseOcclusion } from "./BaseOcclusion";
import { Zoom } from "./ZoomController";

const FFlagUserFixCameraFPError = FlagUtil.getUserFlag("UserFixCameraFPError");

export interface Extrapolation {
	extrapolate: (t: number) => CFrame;
	posVelocity: Vector3;
	rotVelocity: Vector3;
}

export class TransformExtrapolator {
	lastCFrame: CFrame | undefined;

	private static cframeToAxis(cframe: CFrame): Vector3 {
		const [axis, angle] = cframe.ToAxisAngle();
		return axis.mul(angle);
	}

	private static axisToCFrame(axis: Vector3): CFrame {
		const angle: number = axis.Magnitude;
		if (angle > 1e-5) {
			return CFrame.fromAxisAngle(axis, angle);
		}

		return CFrame.identity;
	}

	private static extractRotation(cf: CFrame): CFrame {
		// ROBLOX's code
		// const [_, _, _, xx, yx, zx, xy, yy, zy, xz, yz, zz] = cf.GetComponents();
		// return new CFrame(0, 0, 0, xx, yx, zx, xy, yy, zy, xz, yz, zz);

		return cf.sub(cf.Position);
	}

	Step(dt: number, currentCFrame: CFrame): Extrapolation {
		const lastCFrame = this.lastCFrame ?? currentCFrame;
		this.lastCFrame = currentCFrame;

		const currentPos = currentCFrame.Position;
		const currentRot = TransformExtrapolator.extractRotation(currentCFrame);

		const lastPos = lastCFrame.Position;
		const lastRot = TransformExtrapolator.extractRotation(lastCFrame);

		// Estimate velocities from the delta between now and the last frame
		// This estimation can be a little noisy.
		const dp = (currentPos.sub(lastPos)).div(dt);
		const dr = TransformExtrapolator.cframeToAxis(currentRot.mul(lastRot.Inverse())).div(dt);

		const extrapolate = (t: number) => {
			const p = dp.mul(t).add(currentPos);
			const r = TransformExtrapolator.axisToCFrame(dr.mul(t)).mul(currentRot);

			return r.add(p);
		};

		return {
			extrapolate: extrapolate,
			posVelocity: dp,
			rotVelocity: dr,
		};
	}

	Reset() {
		this.lastCFrame = undefined;
	}
}

export class Poppercam extends BaseOcclusion {
	focusExtrapolator = new TransformExtrapolator();

	GetOcclusionMode(): Enum.DevCameraOcclusionMode | undefined {
		return Enum.DevCameraOcclusionMode.Zoom;
	}

	Enable(enabled: boolean): void {
		this.focusExtrapolator.Reset();
	}

	Update(renderDt: number, desiredCameraCFrame: CFrame, desiredCameraFocus: CFrame): LuaTuple<[CFrame, CFrame]> {
		let rotatedFocus = undefined;

		if (FFlagUserFixCameraFPError) {
			rotatedFocus = CFrame.lookAlong(desiredCameraFocus.Position, desiredCameraCFrame.LookVector.mul(-1)).mul(new CFrame(
				0, 0, 0,
				-1, 0, 0,
				0, 1, 0,
				0, 0, -1
			));
		} else {
			rotatedFocus = new CFrame(desiredCameraFocus.Position, desiredCameraCFrame.Position).mul(new CFrame(
				0, 0, 0,
				-1, 0, 0,
				0, 1, 0,
				0, 0, -1
			));
		}

		const extrapolation = this.focusExtrapolator.Step(renderDt, rotatedFocus);
		const zoom = Zoom.Update(renderDt, rotatedFocus, extrapolation);

		return $tuple(rotatedFocus.mul(new CFrame(0, 0, zoom)), desiredCameraFocus);
	}
}