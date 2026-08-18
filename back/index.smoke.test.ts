import {afterAll, describe, expect, it} from '@jest/globals'
import {spawn, ChildProcessWithoutNullStreams} from 'child_process'
import {existsSync} from 'fs'
import {resolve} from 'path'

// This is a smoke test on the *built* artifact, not a unit test. ts-jest
// resolves the top-level `import config from '../config.json'` differently than
// Node's ESM runtime, so a constructor-level unit test would pass even when the
// shipped app crashes on boot. Spawning the compiled entrypoint under real Node
// is the only honest guard that `npm start` actually starts.
// __dirname is this file's location (back/), injected by ts-jest's CommonJS
// transform, so path resolution is independent of the caller's cwd.
const BACK_DIR = __dirname
const BUILT_ENTRYPOINT = resolve(BACK_DIR, '../dist/back/index.js')
const BOOT_LOG = 'M.I.C.H.E.L. backend service listening on port'
const BOOT_TIMEOUT_MS = 10000

describe('built backend entrypoint', () => {
    let child: ChildProcessWithoutNullStreams | undefined

    afterAll(() => {
        child?.kill('SIGKILL')
    })

    it('boots without crashing and logs that it is listening', async () => {
        // setup
        expect(existsSync(BUILT_ENTRYPOINT)).toBe(true)
        child = spawn('node', [BUILT_ENTRYPOINT], {
            cwd: resolve(BACK_DIR, '..'),
            env: {...process.env, MICH_LOG_PATH: './'},
        })

        // action
        const bootResult = await new Promise<{booted: boolean; output: string}>((resolvePromise) => {
            let output = ''
            const timer = setTimeout(() => resolvePromise({booted: false, output}), BOOT_TIMEOUT_MS)
            const onData = (chunk: Buffer) => {
                output += chunk.toString()
                if (output.includes(BOOT_LOG)) {
                    clearTimeout(timer)
                    resolvePromise({booted: true, output})
                }
            }
            child!.stdout.on('data', onData)
            child!.stderr.on('data', onData)
            child!.on('exit', () => {
                clearTimeout(timer)
                resolvePromise({booted: output.includes(BOOT_LOG), output})
            })
        })

        // assert
        expect(bootResult.output).toContain(BOOT_LOG)
        expect(bootResult.booted).toBe(true)
    }, BOOT_TIMEOUT_MS + 2000)
})
