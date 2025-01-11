import * as core from '@actions/core'
import { Dirent } from 'fs'
import * as fs from 'fs/promises'
import path from 'path'
import {
  createDirectory,
  deleteDirectory,
  execAsRoot,
  writeToFile
} from './utils.js'

export interface BootcImageBuilderOptions {
  configFilePath: string
  image: string
  builderImage: string
  chown?: string
  rootfs?: string
  tlsVerify: boolean
  types?: Array<string>
  awsOptions?: AWSOptions
}

export interface BootcImageBuilderOutputs {
  manifestPath: string
  outputDirectory: string
  outputArtifacts: OutputArtifact[]
}

export interface AWSOptions {
  AMIName: string
  BucketName: string
  Region?: string
}

export interface OutputArtifact {
  type: string
  path: string
}

export async function build(
  options: BootcImageBuilderOptions
): Promise<BootcImageBuilderOutputs> {
  try {
    // Parse the options
    const executible = 'podman'
    const configFileExtension = options.configFilePath.split('.').pop()
    const outputDirectory = './output'

    const tlsVerifyFlag = options.tlsVerify ? '' : '--tls-verify false'
    const chownFlag = options.chown ? `--chown ${options.chown}` : ''

    let typeFlags = ''
    if (options.types && options.types.length > 0) {
      typeFlags = options.types
        .filter((type) => type.trim() !== '')
        .map((type) => `--type ${type}`)
        .join(' ')
    }

    // Workaround GitHub Actions Podman integration issues
    core.debug(
      'Configuring Podman storage (see https://github.com/osbuild/bootc-image-builder/issues/446)'
    )
    await deleteDirectory('/var/lib/containers/storage')
    await createDirectory('/etc/containers')
    const storageConf = Buffer.from(
      '[storage]\ndriver = "overlay"\nrunroot = "/run/containers/storage"\ngraphroot = "/var/lib/containers/storage"\n'
    )
    await writeToFile('/etc/containers/storage.conf', storageConf)

    // Pull the required images
    core.startGroup('Pulling required images')
    await pullImage(options.builderImage, options.tlsVerify)
    await pullImage(options.image, options.tlsVerify)
    core.endGroup()

    // Create the output directory
    await createDirectory(outputDirectory)

    core.debug(
      `Building image ${options.image} using config file ${options.configFilePath} via ${options.builderImage}`
    )

    const args = [
      'run',
      '--rm',
      '--privileged',
      '--security-opt',
      'label=type:unconfined_t',
      '--volume',
      `${options.configFilePath}:/config.${configFileExtension}:ro`,
      '--volume',
      `${outputDirectory}:/output`,
      '--volume',
      '/var/lib/containers/storage:/var/lib/containers/storage',
      options.builderImage,
      'build',
      ...tlsVerifyFlag.split(' '), // --tls-verify <bool>
      ...chownFlag.split(' '), // --chown <uid:gid>
      ...typeFlags.split(' '), // --type <type> ...
      '--output',
      '/output', // --output <dir>
      '--local',
      options.image // <image>
    ].filter((arg) => arg)

    core.startGroup('Building artifact(s)')
    await execAsRoot(executible, args)
    core.endGroup()

    const artifacts = await fs.readdir(outputDirectory, {
      recursive: true,
      withFileTypes: true
    })

    // Get the *.json manifest file from the output directory using fs
    const manifestPath = artifacts.find(
      (file) => file.isFile() && file.name.endsWith('.json')
    )?.name

    // Create a list of <type>:<path> output paths for each type.
    // Some paths may need to be overwritten to match the expected type (e.g. bootiso -> iso)
    const outputArtifacts = await extractArtifactTypes(artifacts)

    return {
      manifestPath: `${outputDirectory}/${manifestPath}`,
      outputDirectory,
      outputArtifacts
    }
  } catch (error) {
    core.setFailed(`Build process failed: ${(error as Error).message}`)

    return {
      manifestPath: '',
      outputDirectory: '',
      outputArtifacts: []
    }
  }
}

async function pullImage(image: string, tlsVerify?: boolean): Promise<void> {
  try {
    const executible = 'podman'
    const tlsFlags = tlsVerify ? '' : '--tls-verify=false'
    await execAsRoot(
      executible,
      ['pull', tlsFlags, image].filter((arg) => arg)
    )
  } catch (error) {
    core.setFailed(`Failed to pull image ${image}: ${(error as Error).message}`)
  }
}

// Return a map of strings to strings, where the key is the type (evaluated from the path) and the value is the path.
// E.G. ./output/bootiso/boot.iso -> { bootiso: ./output/bootiso/boot.iso }
function extractArtifactTypes(files: Dirent[]): Array<OutputArtifact> {
  core.debug(
    `Extracting artifact types from artifact paths: ${JSON.stringify(files)}`
  )

  const outputArtifacts = files
    .filter((file) => file.isFile() && !file.name.endsWith('.json'))
    .map((file) => {
      core.debug(`Extracting type from artifact path: ${JSON.stringify(file)}`)
      const fileName = file.name.split('/').pop()
      core.debug(`Extracted file name: ${fileName}`)

      if (!fileName) {
        throw new Error(
          `Failed to extract file name from artifact path: ${file.name}`
        )
      }

      // Get the type from the path.
      // E.g. ./output/bootiso/boot.iso -> bootiso
      const type = file.parentPath.split('/').pop()
      if (!type) {
        throw new Error(
          `Failed to extract type from artifact path: ${file.parentPath}`
        )
      }

      const pathRelative = `${file.parentPath}/${file.name}`
      const pathAbsolute = path.resolve(pathRelative)

      return { type, path: pathAbsolute }
    })

  return outputArtifacts
}
