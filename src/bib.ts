import * as core from '@actions/core';
import * as exec from "@actions/exec";

export interface BootcImageBuilderOptions {
  configFilePath: string
  image: string
  builderImage?: string
  chown?: string
  rootfs?: string
  tlsVerify?: boolean
  types?: Array<string>
  targetArch?: string
  awsOptions?: AWSOptions
}

export interface AWSOptions {
  AMIName: string
  BucketName: string
  Region?: string
}

export async function build(options: BootcImageBuilderOptions): Promise<void> {
  return new Promise((resolve) => {
    let builderImage = options.builderImage || 'quay.io/centos-bootc/bootc-image-builder:latest'

    // Pull the builder image
    pullImage(builderImage, options.tlsVerify)

    core.debug(`Building image ${options.image} using config file ${options.configFilePath} via ${builderImage}`)
    exec.exec('podman', ['run', '--rm', 'hello-world:latest'], {})
  })
}

function pullImage(image: string, tlsVerify?: boolean): Promise<void> {
  return new Promise((resolve) => {
    // Placeholder for the pull logic
    core.debug(`Pulling image ${image}...`)
    resolve()
  })
}
