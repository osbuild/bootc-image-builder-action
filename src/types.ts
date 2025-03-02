export interface BootcImageBuilderOptions {
  configFilePath: string
  image: string
  builderImage: string
  additionalArgs?: string
  chown?: string
  rootfs?: string
  tlsVerify: boolean
  types?: Array<string>
  awsOptions?: AWSOptions
}

export interface BootcImageBuilderOutputs {
  manifestPath: string
  outputDirectory: string
  outputArtifacts: Map<string, OutputArtifact>
}

export interface AWSOptions {
  AMIName: string
  BucketName: string
  Region?: string
}

export interface OutputArtifact {
  type: string
  path: string
  checksum?: string // Checksum is optional since it might be computed later
}
