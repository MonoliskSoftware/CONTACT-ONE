export type NestedArray<T> = [T, number][];

export function flattenNestedArray<T>(array: NestedArray<T>): T[] {
	return array.reduce((accumulator, current) => {
		const newTemplates = [];

		for (let i = 0; i < current[1]; i++) {
			newTemplates.push(current[0]);
		}

		return [...accumulator, ...newTemplates];
	}, [] as T[]);
}