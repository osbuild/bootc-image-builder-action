export interface BootcImageBuilderOptions {
    configFilePath: string;
    image: string;
    builderImage: string;
    chown?: string;
    rootfs?: string;
    tlsVerify: boolean;
    types?: Array<string>;
    awsOptions?: AWSOptions;
}
export interface BootcImageBuilderOutputs {
    manifestPath: string;
    outputDirectory: string;
    outputArtifacts: OutputArtifact[];
}
export interface AWSOptions {
    AMIName: string;
    BucketName: string;
    Region?: string;
}
export interface OutputArtifact {
    type: string;
    path: string;
}
export declare function build(options: BootcImageBuilderOptions): Promise<BootcImageBuilderOutputs>;
