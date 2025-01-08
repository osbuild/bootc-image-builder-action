import * as core from '@actions/core'
import { build } from './bib.js'

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
    const chown: string = core.getInput('chown')
    const rootfs: string = core.getInput('rootfs')
    const tlsVerify: boolean = core.getInput('tls-verify') === 'true'
    const types: Array<string> = core.getInput('types').split(',')
    const targetArch: string = core.getInput('target-arch')

    // Debug logs are only output if the `ACTIONS_STEP_DEBUG` secret is true
    core.debug(`Building image ${image} using config file ${configFilePath}`)

    // Invoke the main action logic
    await build({
      configFilePath,
      image,
      builderImage,
      chown,
      rootfs,
      tlsVerify,
      types,
      targetArch,
    })

    // Set outputs for other workflow steps to use
    core.setOutput('time', new Date().toTimeString())
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) core.setFailed(error.message)
  }
}
