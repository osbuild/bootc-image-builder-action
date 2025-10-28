import * as core from '@actions/core'
import { build } from './bib.js'
import { AWSOptions, OutputArtifact } from './types.js'

/**
 * The main function for the action.
 *
 * @returns Resolves when the action is complete.
 */
export async function run(): Promise<void> {
  try {
    const configFilePath: string = core.getInput('config-file')
    const image: string = core.getInput('image')
    const builderImage: string = core.getInput('builder-image')
    const platform: string = core.getInput('platform') || 'linux/amd64'
    const additionalArgs: string = core.getInput('additional-args')
    const chown: string = core.getInput('chown')
    const rootfs: string = core.getInput('rootfs')
    const tlsVerify: boolean =
      core.getInput('tls-verify').toLowerCase() === 'true'
    const types: Array<string> = core.getInput('types').split(/[\s,]+/) // Split on whitespace or commas

    // AWS-specific options
    const awsOptions: AWSOptions = {
      AMIName: core.getInput('aws-ami-name'),
      BucketName: core.getInput('aws-bucket'),
      Region: core.getInput('aws-region')
    }

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Building image ${image} using config file ${configFilePath}`)

    // Invoke the main action logic
    const buildOutput = await build({
      configFilePath,
      image,
      builderImage,
      platform,
      additionalArgs,
      chown,
      rootfs,
      tlsVerify,
      types,
      awsOptions
    })

    // Set outputs for other workflow steps to use
    core.setOutput('manifest-path', buildOutput.manifestPath)
    core.setOutput('output-directory', buildOutput.outputDirectory)
    core.setOutput(
      'output-paths',
      JSON.stringify(Object.fromEntries(buildOutput.outputArtifacts.entries()))
    )
    setArtifactSpecificOutputs(buildOutput.outputArtifacts)
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}

function setArtifactSpecificOutputs(
  outputArtifacts: Map<string, OutputArtifact>
): void {
  for (const [type, artifact] of outputArtifacts.entries()) {
    core.debug(
      `Setting output path for ${type} to ${artifact.path} with checksum ${artifact.checksum}`
    )
    core.setOutput(`${type}-output-path`, artifact.path)
    core.setOutput(`${type}-output-checksum`, artifact.checksum)
  }
}
