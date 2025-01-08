export declare function isRootUser(): Promise<boolean>;
export declare function execAsRoot(executable: string, args: string[]): Promise<void>;
export declare function createDirectory(directory: string): Promise<void>;
export declare function deleteDirectory(directory: string): Promise<void>;
export declare function writeToFile(file: string, data: Buffer): Promise<void>;
