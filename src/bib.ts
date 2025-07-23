import * as core from '@actions/core'
import { Dirent } from 'fs'
import * as fs from 'fs/promises'
import path from 'path'
import {
  BootcImageBuilderOptions,
  BootcImageBuilderOutputs,
  OutputArtifact
} from './types.js'
import {
  createDirectory,
  deleteDirectory,
  execAsRoot,
  generateChecksum,
  writeToFile
} from './utils.js'

export async function build(
  options: BootcImageBuilderOptions
): Promise<BootcImageBuilderOutputs> {
  try {
    // Workaround GitHub Actions Podman integration issues
    await githubActionsWorkaroundFixes()

    // Pull the required images
    core.startGroup('Pulling required images')
    await pullImage(options.builderImage, options.tlsVerify, options.platform)
    await pullImage(options.image, options.tlsVerify, options.platform)
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
    if (options.platform) {
      podmanArgs.push(`--platform ${options.platform}`)
    }
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
    bibArgs.push(options.additionalArgs ? options.additionalArgs : '')

    let bibTypeArgs: string[] = []
    if (options.types && options.types.length > 0) {
      bibTypeArgs = options.types
        .filter((type) => type.trim() !== '') // Remove empty strings
        .map((type) => `--type ${type}`)
    }
    bibArgs.push(...bibTypeArgs)

    if (options.types?.includes('ami')) {
      const awsEnv = getAwsEnvironmentVariables()
      for (const [key, value] of Object.entries(awsEnv)) {
        if (key.startsWith('AWS_')) {
          podmanArgs.push(`--env ${key}=${value}`)
        }
      }

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
    bibArgs.push(options.image)

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
async function pullImage(
  image: string,
  tlsVerify?: boolean,
  platform?: string
): Promise<void> {
  try {
    const executible = 'podman'
    const tlsFlags = tlsVerify ? '' : '--tls-verify=false'
    const platformFlag = platform ? `--platform ${platform}` : ''
    await execAsRoot(
      executible,
      ['pull', tlsFlags, platformFlag, image].filter((arg) => arg)
    )
  } catch (error) {
    core.setFailed(`Failed to pull image ${image}: ${(error as Error).message}`)
  }
}

// Extract artifact types and compute checksums asynchronously
async function extractArtifactTypes(
  files: Dirent[]
): Promise<Map<string, OutputArtifact>> {
  core.debug(
    `Extracting artifact types from artifact paths: ${JSON.stringify(files)}`
  )

  const outputArtifacts: Promise<OutputArtifact>[] = files
    .filter((file) => file.isFile() && !file.name.endsWith('.json'))
    .map(async (file) => {
      core.debug(`Extracting type from artifact path: ${JSON.stringify(file)}`)
      const fileName = file.name.split('/').pop()
      core.debug(`Extracted file name: ${fileName}`)

      if (!fileName) {
        throw new Error(
          `Failed to extract file name from artifact path: ${file.name}`
        )
      }

      let type = file.parentPath.split('/').pop()
      if (!type) {
        throw new Error(
          `Failed to extract type from artifact path: ${file.parentPath}`
        )
      }

      // Convert types
      switch (type) {
        case 'bootiso':
          type = 'anaconda-iso'
          break
        case 'vpc':
          type = 'vhd'
          break
        case 'image':
          type = 'raw'
          break
        default:
          break
      }

      const pathRelative = `${file.parentPath}/${file.name}`
      const pathAbsolute = path.resolve(pathRelative)

      const checksum = await generateChecksum(pathAbsolute, 'sha256')

      return { type, path: pathAbsolute, checksum }
    })

  // Resolve all checksum promises
  const resolvedArtifacts = await Promise.all(outputArtifacts)

  const artifactMap = new Map<string, OutputArtifact>()
  resolvedArtifacts.forEach((artifact) => {
    if (artifactMap.has(artifact.type)) {
      core.debug(`Type "${artifact.type}" already exists in the map. Skipping.`)
    } else {
      artifactMap.set(artifact.type, artifact)
    }
  })

  return artifactMap
}

// Fix for GitHub Actions Podman integration issues
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

// Get all AWS_* environment variables in a key-value map
function getAwsEnvironmentVariables(): Record<string, string> {
  const awsEnv: Record<string, string> = {}

  // List of AWS env vars that are generally NOT secrets
  const nonSecretKeys = new Set([
    'AWS_REGION',
    'AWS_DEFAULT_REGION',
    'AWS_PROFILE',
    'AWS_EXECUTION_ENV',
    'AWS_ROLE_SESSION_NAME',
    'AWS_DEFAULT_OUTPUT'
  ])

  for (const [key, value] of Object.entries(process.env)) {
    if (key.startsWith('AWS_') && value !== undefined) {
      awsEnv[key] = value

      // Only mask sensitive values
      if (!nonSecretKeys.has(key)) {
        core.setSecret(value)
      }
    }
  }

  return awsEnv
}
