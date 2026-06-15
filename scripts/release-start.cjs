/**
 * Start a new release.
 *
 * Usage:
 *   npm run release:start -- <major|minor|patch>
 *
 * What it does (in order, aborting on the first failure):
 *   1. Validates the bump argument.
 *   2. Verifies we are inside a git work tree with a clean status.
 *   3. Fetches `origin/main` so the release branches off the latest remote tip.
 *   4. Computes the next semver from the root package.json.
 *   5. Refuses to proceed if `release/v<x.y.z>` already exists locally or on origin.
 *   6. Creates and checks out `release/v<x.y.z>` from `origin/main`.
 *   7. Runs `npm version <type> --no-git-tag-version` to bump package.json
 *      (and package-lock.json if present).
 *   8. Commits the bump with message "Release v<x.y.z>".
 *   9. Pushes the new branch to origin with upstream tracking.
 *
 * The script intentionally does NOT create a git tag — `release.yml` triggers on
 * `tags: v*`, and tagging should happen after the release PR is merged into main.
 */

'use strict'

const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const path = require('node:path')

const REPO_ROOT = path.resolve(__dirname, '..')
const PKG_PATH = path.join(REPO_ROOT, 'package.json')
const VALID_BUMPS = ['major', 'minor', 'patch']

function fail(message) {
    process.stderr.write(`[release:start] ERROR: ${message}\n`)
    process.exit(1)
}

function info(message) {
    process.stdout.write(`[release:start] ${message}\n`)
}

/**
 * Run a command, inheriting stdio so the user sees real-time output.
 * Throws on non-zero exit code unless `allowFailure` is true (in which case
 * the SpawnSyncReturns object is returned so the caller can inspect status).
 */
function run(cmd, args, { allowFailure = false, cwd = REPO_ROOT } = {}) {
    const result = spawnSync(cmd, args, {
        stdio: 'inherit',
        cwd,
        // On Windows, `git` and `npm` are resolved via PATHEXT; `shell: true`
        // is the simplest way to make `npm` (which is `npm.cmd`) invokable here.
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

/**
 * Same as run() but captures stdout and never inherits stdio. Used for
 * inspection commands where we want to read the output (e.g. `git status
 * --porcelain`).
 */
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

function parseSemver(version) {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version)
    if (!match) {
        fail(
            `Current package.json version "${version}" is not a plain MAJOR.MINOR.PATCH ` +
            `string. This script does not handle pre-release / build metadata suffixes.`
        )
    }
    return {
        major: Number(match[1]),
        minor: Number(match[2]),
        patch: Number(match[3]),
    }
}

function bumpSemver({ major, minor, patch }, type) {
    switch (type) {
        case 'major': return `${major + 1}.0.0`
        case 'minor': return `${major}.${minor + 1}.0`
        case 'patch': return `${major}.${minor}.${patch + 1}`
        default:      fail(`Unknown bump type "${type}".`)
    }
}

function main() {
    const bumpType = process.argv[2]
    if (!bumpType || !VALID_BUMPS.includes(bumpType)) {
        process.stderr.write(
            'Usage: npm run release:start -- <major|minor|patch>\n'
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

    // 2. Clean working tree?
    const status = capture('git', ['status', '--porcelain'])
    if (status.stdout.trim() !== '') {
        fail(
            'Working tree is not clean. Commit, stash, or discard your changes ' +
            'before starting a release.\n' + status.stdout
        )
    }

    // 3. Fetch origin/main.
    info('Fetching origin/main…')
    run('git', ['fetch', 'origin', 'main'])

    // 4. Compute the next version from the *current* root package.json.
    //    (We do this BEFORE switching branches so the branch name is known up
    //    front, but we recompute again from origin/main's package.json below
    //    to make sure we're bumping the right baseline.)
    const localPkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'))
    const localCurrent = localPkg.version

    // Read the version on origin/main so we bump from THAT, not from whatever
    // happens to be checked out locally.
    const remoteVersionRaw = capture('git', ['show', 'origin/main:package.json'])
    let remotePkg
    try {
        remotePkg = JSON.parse(remoteVersionRaw.stdout)
    } catch (err) {
        fail(`Could not parse origin/main:package.json: ${err.message}`)
    }
    const baseVersion = remotePkg.version
    if (!baseVersion) {
        fail('origin/main:package.json has no "version" field.')
    }

    const nextVersion = bumpSemver(parseSemver(baseVersion), bumpType)
    const branchName = `release/v${nextVersion}`

    info(`Local package.json:       ${localCurrent}`)
    info(`origin/main package.json: ${baseVersion}`)
    info(`Next version (${bumpType}):${' '.repeat(Math.max(1, 7 - bumpType.length))}${nextVersion}`)
    info(`Release branch:           ${branchName}`)

    // 5. Branch must not already exist locally or remotely.
    const localBranch = capture(
        'git',
        ['show-ref', '--verify', '--quiet', `refs/heads/${branchName}`],
        { allowFailure: true }
    )
    if (localBranch.status === 0) {
        fail(`Local branch "${branchName}" already exists. Delete it first or pick a different bump.`)
    }
    const remoteBranch = capture(
        'git',
        ['ls-remote', '--exit-code', '--heads', 'origin', branchName],
        { allowFailure: true }
    )
    if (remoteBranch.status === 0) {
        fail(`Remote branch "origin/${branchName}" already exists. Delete it first or pick a different bump.`)
    }

    // 6. Create the release branch off origin/main.
    info(`Creating ${branchName} from origin/main…`)
    run('git', ['checkout', '-b', branchName, 'origin/main'])

    // 7. Bump the version. `npm version` writes package.json (+ package-lock.json
    //    when present), no tag, no commit.
    info(`Bumping version to ${nextVersion}…`)
    run('npm', ['version', bumpType, '--no-git-tag-version'])

    // Sanity check: the file on disk now matches what we predicted.
    const bumpedPkg = JSON.parse(fs.readFileSync(PKG_PATH, 'utf-8'))
    if (bumpedPkg.version !== nextVersion) {
        fail(
            `Post-bump version mismatch: package.json is "${bumpedPkg.version}", ` +
            `expected "${nextVersion}". Aborting before commit.`
        )
    }

    // 8. Stage and commit. Only stage files that actually exist; package-lock.json
    //    is optional (this repo does not currently track one at the root, but
    //    that may change).
    const filesToStage = ['package.json']
    if (fs.existsSync(path.join(REPO_ROOT, 'package-lock.json'))) {
        filesToStage.push('package-lock.json')
    }
    run('git', ['add', ...filesToStage])
    run('git', ['commit', '-m', `"Release v${nextVersion}"`])

    // 9. Push with upstream tracking.
    info(`Pushing ${branchName} to origin…`)
    run('git', ['push', '-u', 'origin', branchName])

    process.stdout.write(
        '\n' +
        'Release branch ready:\n' +
        `  branch:  ${branchName}\n` +
        `  version: ${nextVersion} (was ${baseVersion})\n` +
        '  remote:  pushed to origin\n' +
        '\n' +
        'Next steps:\n' +
        `  - Open a PR from ${branchName} into main.\n` +
        `  - After merge, tag with \`git tag v${nextVersion} && git push origin v${nextVersion}\`\n` +
        '    to trigger the release workflow.\n'
    )
}

main()
