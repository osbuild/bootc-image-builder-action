import * as core from '@actions/core'
import * as exec from '@actions/exec'
import crypto from 'crypto'
import { createReadStream } from 'fs'
import * as os from 'os'

export async function isRootUser(): Promise<boolean> {
  return os.userInfo().uid === 0
}

export async function execAsRoot(
  executable: string,
  args: string[]
): Promise<exec.ExecOutput> {
  const isRoot = await isRootUser()
  if (!isRoot) {
    args.unshift(executable)
    executable = 'sudo'
  }

  return await exec.getExecOutput(executable, args)
}

export async function execAsUser(
  executable: string,
  args: string[]
): Promise<exec.ExecOutput> {
  return await exec.getExecOutput(executable, args)
}

export async function createDirectory(directory: string): Promise<void> {
  try {
    const executible = 'mkdir'
    await execAsRoot(executible, ['-p', directory])
  } catch (error) {
    core.setFailed(
      `Failed to create directory ${directory}: ${(error as Error).message}`
    )
  }
}

export async function deleteDirectory(directory: string): Promise<void> {
  try {
    const executible = 'rm'
    await execAsRoot(executible, ['-rf', directory])
  } catch (error) {
    core.setFailed(
      `Failed to delete directory ${directory}: ${(error as Error).message}`
    )
  }
}

export async function writeToFile(file: string, data: Buffer): Promise<void> {
  try {
    const tempFile = `${file}.tmp`
    await execAsRoot('sh', ['-c', `echo '${data.toString()}' > ${tempFile}`])
    await execAsRoot('mv', [tempFile, file])
  } catch (error) {
    core.setFailed(
      `Failed to write to file ${file}: ${(error as Error).message}`
    )
  }
}

export async function readFromFile(file: string): Promise<Buffer> {
  try {
    const data = Buffer.alloc(0)
    await execAsRoot('sh', ['-c', `cat ${file} > ${data}`])
    return data
  } catch (error) {
    core.setFailed(
      `Failed to read from file ${file}: ${(error as Error).message}`
    )
    return Buffer.alloc(0)
  }
}

// Calculate the checksum asynchronously
export function generateChecksum(
  filePath: string,
  checksumType: string
): Promise<string> {
  switch (checksumType) {
    case 'sha256':
      return generateSHA256Checksum(filePath)
    default:
      return Promise.reject(new Error(`Unknown checksum type: ${checksumType}`))
  }
}

// Generate SHA256 checksum asynchronously
export function generateSHA256Checksum(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256')
    const stream = createReadStream(filePath)

    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('error', (err) =>
      reject(`Failed to generate checksum: ${err.message}`)
    )
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}
