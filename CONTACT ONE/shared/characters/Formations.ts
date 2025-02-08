export namespace Formations {
	export enum FormationType {
		/**
		 *     U
		 *   U   U
		 * U       U
		 */
		WEDGE,
		/**
		 * U
		 * 
		 * U
		 * 
		 * U
		 */
		COLUMN,
		/**
		 * U
		 * U
		 * U
		 */
		FILE,
		/**
		 * U
		 *   U
		 * U
		 *   U
		 */
		STAGGERED_COLUMN,
	}

	export const FormationComputers: { [key in FormationType]: (i: number) => Vector2 } = {
		[FormationType.WEDGE]: (i) => i === 0 ? Vector2.zero : new Vector2((i % 2 === 0 ? -1 : 1) * math.ceil(i / 2), math.ceil(i / 2)),
		[FormationType.COLUMN]: (i) => new Vector2(0, 2 * i),
		[FormationType.FILE]: (i) => new Vector2(0, i),
		[FormationType.STAGGERED_COLUMN]: (i) => new Vector2(i % 2, i),
	};
}