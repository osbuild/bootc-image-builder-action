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
    const configOptions = parseConfigurationOptions(options)

    core.debug(
      'Configuring Podman storage (see https://github.com/osbuild/bootc-image-builder/issues/446)'
    )
    await setupPodmanStorageConfiguration()

    core.startGroup('Pulling required images')
    await pullImage(options.builderImage, options.tlsVerify)
    await pullImage(options.image, options.tlsVerify)
    core.endGroup()

    await prepareOutputDirectory(configOptions.outputDirectory)

    core.debug(
      `Building image ${options.image} using config file ${options.configFilePath} via ${options.builderImage}`
    )

    const args = generatePodmanRunArgs(configOptions, options)

    core.startGroup('Building artifact(s)')
    await execAsRoot('podman', args)
    core.endGroup()

    const artifacts = await readAndFilterArtifacts(configOptions.outputDirectory)
    const manifestPath = extractManifestPath(artifacts, configOptions.outputDirectory)
    const outputArtifacts = extractArtifactTypes(artifacts)

    return {
      manifestPath,
      outputDirectory: configOptions.outputDirectory,
      outputArtifacts
    }
  } catch (error) {
    return handleBuildError(error as Error)
  }
}

function parseConfigurationOptions(options: BootcImageBuilderOptions) {
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

  return {
    configFileExtension,
    outputDirectory,
    tlsVerifyFlag,
    chownFlag,
    typeFlags
  }
}

async function setupPodmanStorageConfiguration(): Promise<void> {
  await deleteDirectory('/var/lib/containers/storage')
  await createDirectory('/etc/containers')
  const storageConf = Buffer.from(
    '[storage]\ndriver = "overlay"\nrunroot = "/run/containers/storage"\ngraphroot = "/var/lib/containers/storage"\n'
  )
  await writeToFile('/etc/containers/storage.conf', storageConf)
}

async function prepareOutputDirectory(directory: string): Promise<void> {
  await createDirectory(directory)
}

function generatePodmanRunArgs(configOptions: any, options: BootcImageBuilderOptions) {
  return [
    'run',
    '--rm',
    '--privileged',
    '--security-opt',
    'label=type:unconfined_t',
    '--volume',
    `${options.configFilePath}:/config.${configOptions.configFileExtension}:ro`,
    '--volume',
    `${configOptions.outputDirectory}:/output`,
    '--volume',
    '/var/lib/containers/storage:/var/lib/containers/storage',
    options.builderImage,
    'build',
    ...configOptions.tlsVerifyFlag.split(' '),
    ...configOptions.chownFlag.split(' '),
    ...configOptions.typeFlags.split(' '),
    '--output',
    '/output',
    '--local',
    options.image
  ].filter((arg) => arg)
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

async function readAndFilterArtifacts(directory: string): Promise<Dirent[]> {
  return await fs.readdir(directory, {
    recursive: true,
    withFileTypes: true
  })
}

function extractManifestPath(artifacts: Dirent[], outputDirectory: string): string {
  const manifest = artifacts.find(
    (file) => file.isFile() && file.name.endsWith('.json')
  )?.name
  return `${outputDirectory}/${manifest}`
}

function extractArtifactTypes(files: Dirent[]): Array<OutputArtifact> {
  core.debug(
    `Extracting artifact types from artifact paths: ${JSON.stringify(files)}`
  )

  return files
    .filter((file) => file.isFile() && !file.name.endsWith('.json'))
    .map((file) => {
      core.debug(`Extracting type from artifact path: ${JSON.stringify(file)}`)
      const fileName = file.name.split('/').pop()

      if (!fileName) {
        throw new Error(`Failed to extract file name from artifact path: ${file.name}`)
      }

      const type = file.parentPath.split('/').pop()
      if (!type) {
        throw new Error(`Failed to extract type from artifact path: ${file.parentPath}`)
      }

      const pathRelative = `${file.parentPath}/${file.name}`
      const pathAbsolute = path.resolve(pathRelative)

      return { type, path: pathAbsolute }
    })
}

function handleBuildError(error: Error): BootcImageBuilderOutputs {
  core.setFailed(`Build process failed: ${error.message}`)
  return {
    manifestPath: '',
    outputDirectory: '',
    outputArtifacts: []
  }
}
