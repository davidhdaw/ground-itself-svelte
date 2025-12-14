// Database types will be generated after schema creation
// For now, using a basic type structure
export type Json =
	| string
	| number
	| boolean
	| null
	| { [key: string]: Json | undefined }
	| Json[];

export interface Database {
	public: {
		Tables: {
			// Tables will be defined here after schema creation
			[key: string]: {
				Row: Record<string, unknown>;
				Insert: Record<string, unknown>;
				Update: Record<string, unknown>;
			};
		};
		Views: {
			[key: string]: {
				Row: Record<string, unknown>;
			};
		};
		Functions: {
			[key: string]: {
				Args: Record<string, unknown>;
				Returns: unknown;
			};
		};
		Enums: {
			[key: string]: string;
		};
	};
}
