export interface BootcImageBuilderOptions {
    configFilePath: string;
    image: string;
    builderImage?: string;
    chown?: string;
    rootfs?: string;
    tlsVerify?: boolean;
    types?: Array<string>;
    targetArch?: string;
    awsOptions?: AWSOptions;
}
export interface AWSOptions {
    AMIName: string;
    BucketName: string;
    Region?: string;
}
export declare function build(options: BootcImageBuilderOptions): Promise<void>;
