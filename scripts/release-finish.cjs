/**
 * Finish a release: tag the current `origin/main` tip with `v<version>` and
 * push the tag, which triggers `.github/workflows/release.yml`.
 *
 * Usage:
 *   npm run release:finish
 *
 * What it does (in order, aborting on the first failure):
 *   1. Verifies we are inside a git work tree with a clean status.
 *   2. Fetches origin (refs + tags) so local view of main and existing tags
 *      is up to date.
 *   3. Reads the version from `origin/main:package.json`. THAT is what gets
 *      tagged — the user's local branch is irrelevant.
 *   4. Refuses to proceed if `v<x.y.z>` already exists locally or on origin.
 *   5. Creates an annotated tag `v<x.y.z>` pointing at `origin/main`.
 *   6. Pushes the tag to origin (which fires the release workflow).
 *
 * The script never modifies branches, never amends commits, never deletes
 * tags. Failure modes are: clean abort with a non-zero exit code and a
 * descriptive message.
 */

'use strict'

const { spawnSync } = require('node:child_process')
const path = require('node:path')

const REPO_ROOT = path.resolve(__dirname, '..')

function fail(message) {
    process.stderr.write(`[release:finish] ERROR: ${message}\n`)
    process.exit(1)
}

function info(message) {
    process.stdout.write(`[release:finish] ${message}\n`)
}

function run(cmd, args, { allowFailure = false, cwd = REPO_ROOT } = {}) {
    const result = spawnSync(cmd, args, {
        stdio: 'inherit',
        cwd,
        shell: process.platform === 'win32',
    })
    if (result.error) {
        if (allowFailure) return result
        fail(`Failed to spawn \`${cmd} ${args.join(' ')}\`: ${result.error.message}`)
    }
    if (!allowFailure && result.status !== 0) {
        fail(`\`${cmd} ${args.join(' ')}\` exited with status ${result.status}.`)
    }
    return result
}

function capture(cmd, args, { allowFailure = false, cwd = REPO_ROOT } = {}) {
    const result = spawnSync(cmd, args, {
        cwd,
        encoding: 'utf-8',
        shell: process.platform === 'win32',
    })
    if (result.error) {
        if (allowFailure) return result
        fail(`Failed to spawn \`${cmd} ${args.join(' ')}\`: ${result.error.message}`)
    }
    if (!allowFailure && result.status !== 0) {
        fail(
            `\`${cmd} ${args.join(' ')}\` exited with status ${result.status}.\n` +
            `stderr: ${result.stderr?.trim() ?? ''}`
        )
    }
    return result
}

function assertSemver(version) {
    if (!/^\d+\.\d+\.\d+$/.test(version)) {
        fail(
            `origin/main package.json version "${version}" is not a plain ` +
            `MAJOR.MINOR.PATCH string. This script does not handle pre-release ` +
            `or build-metadata suffixes.`
        )
    }
}

function main() {
    if (process.argv.length > 2) {
        process.stderr.write(
            'Usage: npm run release:finish\n' +
            '(This script takes no arguments — the version is read from origin/main.)\n'
        )
        process.exit(1)
    }

    // 1. Inside a git work tree?
    const inRepo = capture('git', ['rev-parse', '--is-inside-work-tree'], {
        allowFailure: true,
    })
    if (inRepo.status !== 0 || inRepo.stdout.trim() !== 'true') {
        fail('Not inside a git work tree.')
    }

    // 2. Clean working tree? Not strictly required (we tag a remote ref, not
    //    HEAD) but a dirty tree usually means the user is mid-task and didn't
    //    mean to run a release script.
    const status = capture('git', ['status', '--porcelain'])
    if (status.stdout.trim() !== '') {
        fail(
            'Working tree is not clean. Commit, stash, or discard your changes ' +
            'before finishing a release.\n' + status.stdout
        )
    }

    // 3. Fetch refs + tags from origin.
    info('Fetching origin (with tags)…')
    run('git', ['fetch', '--tags', 'origin', 'main'])

    // 4. Read the version from origin/main:package.json.
    const remotePkgRaw = capture('git', ['show', 'origin/main:package.json'])
    let remotePkg
    try {
        remotePkg = JSON.parse(remotePkgRaw.stdout)
    } catch (err) {
        fail(`Could not parse origin/main:package.json: ${err.message}`)
    }
    const version = remotePkg.version
    if (!version) {
        fail('origin/main:package.json has no "version" field.')
    }
    assertSemver(version)

    const tagName = `v${version}`

    // Resolve the SHA of origin/main so the user knows exactly what is being
    // tagged, and so we can tag that SHA explicitly instead of relying on a
    // ref name that could move between commands.
    const mainSha = capture('git', ['rev-parse', 'origin/main']).stdout.trim()

    info(`Version on origin/main: ${version}`)
    info(`Tag to create:          ${tagName}`)
    info(`Target commit:          ${mainSha}`)

    // 5. Tag must not already exist locally or remotely.
    const localTag = capture(
        'git',
        ['show-ref', '--verify', '--quiet', `refs/tags/${tagName}`],
        { allowFailure: true }
    )
    if (localTag.status === 0) {
        fail(
            `Local tag "${tagName}" already exists. Delete it with ` +
            `\`git tag -d ${tagName}\` if you really mean to recreate it.`
        )
    }
    const remoteTag = capture(
        'git',
        ['ls-remote', '--exit-code', '--tags', 'origin', tagName],
        { allowFailure: true }
    )
    if (remoteTag.status === 0) {
        fail(
            `Remote tag "origin/${tagName}" already exists. The release workflow ` +
            `has likely already been triggered for this version. If you really ` +
            `need to re-release, delete the remote tag first ` +
            `(\`git push --delete origin ${tagName}\`) — but be aware this is ` +
            `disruptive and will not re-run any already-completed workflow.`
        )
    }

    // 6. Create the annotated tag pointing at the resolved SHA.
    info(`Creating annotated tag ${tagName}…`)
    run('git', ['tag', '-a', tagName, '-m', `"Release ${tagName}"`, mainSha])

    // 7. Push only the tag (not the current branch).
    info(`Pushing ${tagName} to origin…`)
    run('git', ['push', 'origin', tagName])

    process.stdout.write(
        '\n' +
        'Release tagged and pushed:\n' +
        `  tag:    ${tagName}\n` +
        `  commit: ${mainSha}\n` +
        '  remote: pushed to origin\n' +
        '\n' +
        'The `Release build` workflow should now be running on GitHub Actions.\n' +
        'Track it at the Actions tab of your repository on GitHub.\n'
    )
}

main()
