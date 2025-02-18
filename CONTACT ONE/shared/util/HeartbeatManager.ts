import { RunService } from "@rbxts/services";

export type HeartbeatCallback = (deltaTime: number) => void;
export type CategoryDescription = {
	/**
	 * Arbitrary cost of calling the callbacks in this category.
	 */
	cost: number,
	/**
	 * Arbitrary total budget per frame allocated to this category.
	 */
	budget: number
};

/**
 * array1 ∩ array2
 */
function intersection<T extends defined>(array1: T[], array2: T[]): T[] {
	return array1.filter(item => array2.includes(item));
}

/**
 * array1 − array2
 */
function subtract<T extends defined>(array1: T[], array2: T[]): T[] {
	return array1.filter(item => !array2.includes(item));
}

/**
 * The HeartbeatManager is responsible for managing categorized and cost based entity updating.
 */
export class HeartbeatManager {
	private static callbacks = new Map<string, HeartbeatCallback[]>();
	private static categories = new Map<string, CategoryDescription>();
	private static completedCallbacks = new Map<string, HeartbeatCallback[]>();

	private static deregisterCategory(category: string) {

	}

	private static updateCategory(category: string, deltaTime: number) {
		debug.profilebegin(`Heartbeat on ${category}`);

		const config = this.categories.get(category)!;
		const callbacks = this.callbacks.get(category)!;

		const completed = intersection(callbacks, this.completedCallbacks.get(category)!);
		const uncompleted = subtract(callbacks, completed);

		const callbacksThatWereCompleted = [];

		let spentCost = 0;
		let i = 0;

		while (spentCost + config.cost < config.budget && i < uncompleted.size()) {
			uncompleted[i](deltaTime);
			callbacksThatWereCompleted.push(uncompleted[i]);

			spentCost += config.cost;
			i++;
		}

		if (callbacksThatWereCompleted.size() < uncompleted.size() && uncompleted.size() > 0) {
			this.completedCallbacks.set(category, [...completed, ...callbacksThatWereCompleted]);
		} else {
			this.completedCallbacks.set(category, []);
		}

		debug.profileend();
	}

	public static bind(category: string, callback: HeartbeatCallback): HeartbeatCallback {
		if (!this.categories.has(category)) throw `Category ${category} has not been registered! Use HeartbeatManager.registerCategory first!`;

		this.callbacks.get(category)!.push(callback);

		return callback;
	}

	public static disconnect(category: string, callback: HeartbeatCallback) {
		this.callbacks.set(category, this.callbacks.get(category)!.filter(other => other !== callback));
	}

	public static registerCategory(category: string, config: CategoryDescription) {
		this.callbacks.set(category, []);
		this.completedCallbacks.set(category, []);
		this.categories.set(category, config);

		RunService.Heartbeat.Connect(deltaTime => this.updateCategory(category, deltaTime));
	}
}