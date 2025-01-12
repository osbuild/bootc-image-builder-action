import * as exec from '@actions/exec';
export declare function isRootUser(): Promise<boolean>;
export declare function execAsRoot(executable: string, args: string[]): Promise<exec.ExecOutput>;
export declare function execAsUser(executable: string, args: string[]): Promise<exec.ExecOutput>;
export declare function createDirectory(directory: string): Promise<void>;
export declare function deleteDirectory(directory: string): Promise<void>;
export declare function writeToFile(file: string, data: Buffer): Promise<void>;
export declare function readFromFile(file: string): Promise<Buffer>;
