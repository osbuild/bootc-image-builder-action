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
}

export async function build(
  options: BootcImageBuilderOptions
): Promise<BootcImageBuilderOutputs> {
  try {
    // Workaround GitHub Actions Podman integration issues
    await githubActionsWorkaroundFixes()

    // Pull the required images
    core.startGroup('Pulling required images')
    await pullImage(options.builderImage, options.tlsVerify)
    await pullImage(options.image, options.tlsVerify)
    core.endGroup()

    // Create the output directory
    const outputDirectory = './output'
    await createDirectory(outputDirectory)

    core.debug(
      `Building image ${options.image} using config file ${options.configFilePath} via ${options.builderImage}`
    )

    const executible = 'podman'
    const podmanArgs = []
    const bibArgs = []

    podmanArgs.push('run')
    podmanArgs.push('--rm')
    podmanArgs.push('--privileged')
    podmanArgs.push('--security-opt label=type:unconfined_t')
    podmanArgs.push(
      '--volume /var/lib/containers/storage:/var/lib/containers/storage'
    )
    podmanArgs.push(`--volume ${outputDirectory}:/output`)
    podmanArgs.push(
      `--volume ${options.configFilePath}:/config.${options.configFilePath.split('.').pop()}:ro`
    )

    bibArgs.push('build')
    bibArgs.push('--output /output')
    bibArgs.push(options.tlsVerify ? '' : '--tls-verify false')
    bibArgs.push(options.chown ? `--chown ${options.chown}` : '')
    bibArgs.push(options.rootfs ? `--rootfs ${options.rootfs}` : '')

    let bibTypeArgs: string[] = []
    if (options.types && options.types.length > 0) {
      bibTypeArgs = options.types
        .filter((type) => type.trim() !== '') // Remove empty strings
        .map((type) => `--type ${type}`)
    }
    bibArgs.push(...bibTypeArgs)

    if (options.types?.includes('aws')) {
      podmanArgs.push('--env AWS_*')

      bibArgs.push(`--aws-bucket ${options.awsOptions?.BucketName}`)
      bibArgs.push(`--aws-ami-name ${options.awsOptions?.AMIName}`)
      bibArgs.push(
        options.awsOptions?.Region
          ? `--aws-region ${options.awsOptions?.Region}`
          : ''
      )
    }

    // The builder image and BIB image must be the last arguments of each command
    podmanArgs.push(options.builderImage)
    bibArgs.push(`--local ${options.image}`)

    core.startGroup('Building artifact(s)')
    await execAsRoot(
      executible,
      [...podmanArgs, ...bibArgs]
        .filter((arg) => arg)
        .join(' ')
        .split(' ') // Remove empty strings and split by spaces
    )
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
      outputArtifacts: new Map()
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
function extractArtifactTypes(files: Dirent[]): Map<string, OutputArtifact> {
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

  // Create a Map where the key is the type and the value is the OutputArtifact
  const artifactMap = new Map<string, OutputArtifact>()

  outputArtifacts.forEach((artifact) => {
    if (artifactMap.has(artifact.type)) {
      core.debug(`Type "${artifact.type}" already exists in the map. Skipping.`)
      // Optionally, you could update or replace the existing artifact here.
      // For example, you can decide to keep the first encountered artifact for each type.
    } else {
      artifactMap.set(artifact.type, artifact)
    }
  })

  return artifactMap
}

async function githubActionsWorkaroundFixes(): Promise<void> {
  core.debug(
    'Configuring Podman storage (see https://github.com/osbuild/bootc-image-builder/issues/446)'
  )
  await deleteDirectory('/var/lib/containers/storage')
  await createDirectory('/etc/containers')
  const storageConf = Buffer.from(
    '[storage]\ndriver = "overlay"\nrunroot = "/run/containers/storage"\ngraphroot = "/var/lib/containers/storage"\n'
  )
  await writeToFile('/etc/containers/storage.conf', storageConf)
}
