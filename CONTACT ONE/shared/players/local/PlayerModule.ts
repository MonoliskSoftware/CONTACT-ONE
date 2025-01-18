import { CameraModule } from "./cameras/CameraModule";
import { ControlModule } from "./controls/ControlModule";

export class PlayerModule {
	public readonly cameras = new CameraModule(this);
	public readonly controls = new ControlModule(this);
	
	constructor() {

	}
}