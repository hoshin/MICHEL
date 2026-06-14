const { app } = require('electron')
const fs = require('node:fs')
const path = require('node:path')

const DEFAULTS = {
    ports: { frontServer: 5173, backServer: 3000 },
    debug: false,
    secrets: { faceItAPIKey: '' },
    preferences: { openDevTools: false },
    overlays: {},
}

function isPlainObject(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function deepMerge(target, source) {
    if (!isPlainObject(source)) {
        return target
    }
    for (const key of Object.keys(source)) {
        const sourceValue = source[key]
        const targetValue = target[key]
        if (isPlainObject(sourceValue) && isPlainObject(targetValue)) {
            target[key] = deepMerge(targetValue, sourceValue)
        } else {
            target[key] = sourceValue
        }
    }
    return target
}

function deepFreeze(object) {
    if (!isPlainObject(object)) {
        return object
    }
    for (const key of Object.keys(object)) {
        deepFreeze(object[key])
    }
    return Object.freeze(object)
}

function getConfigPath() {
    return path.join(app.getPath('userData'), 'config.json')
}

function readConfigFromDisk() {
    const configPath = getConfigPath()
    if (!fs.existsSync(configPath)) {
        return {}
    }
    try {
        const parsedConfig = JSON.parse(fs.readFileSync(configPath, 'utf-8'))
        if(isPlainObject(parsedConfig)) {
            return parsedConfig
        }
        return {}
    } catch (err) {
        console.error(`[config] Failed to read or parse ${configPath}.`, err)
        return {}
    }
}

function writeConfigToDisk(config) {
    const configPath = getConfigPath()
    const tmpPath = `${configPath}.tmp`
    const serialized = JSON.stringify(config, null, 2)
    // Atomic write: write to a temp file in the same directory and rename.
    // Renames are atomic on the same volume, so readers never see a truncated file.
    fs.writeFileSync(tmpPath, serialized, 'utf-8')
    fs.renameSync(tmpPath, configPath)
}

function loadConfig() {
    const configPath = getConfigPath()
    console.log(`[config] Loading configuration from: ${configPath}`)
    let userConfig = {}

    if (fs.existsSync(configPath)) {
        try {
            const raw = fs.readFileSync(configPath, 'utf-8')
            userConfig = JSON.parse(raw)
            console.log(`[config] Loaded existing configuration file.`)
        } catch (err) {
            console.error(`[config] Failed to read or parse ${configPath}, falling back to defaults.`, err)
            userConfig = {}
        }
    } else {
        try {
            writeConfigToDisk(DEFAULTS)
            console.log(`[config] Created default configuration file at ${configPath}`)
        } catch (err) {
            console.error(`[config] Failed to create default configuration file at ${configPath}.`, err)
        }
    }

    const merged = deepMerge(structuredClone(DEFAULTS), userConfig)
    return deepFreeze(merged)
}

/**
 * Merge a partial update into the on-disk configuration and return the new
 * fully-merged (defaults + on-disk + patch), frozen config.
 *
 * The on-disk file is updated atomically. The in-memory config returned by a
 * previous loadConfig() call is NOT mutated (it stays frozen); callers should
 * use the returned object as the new source of truth from this point on.
 *
 * @param {object} patch - partial config object to deep-merge over the current on-disk one
 * @returns {object} the new frozen config
 */
function saveConfig(patch) {
    if (!isPlainObject(patch)) {
        throw new TypeError('saveConfig expects an object patch')
    }
    const currentOnDisk = readConfigFromDisk()
    const updated = deepMerge(structuredClone(currentOnDisk), patch)
    writeConfigToDisk(updated)
    console.log(`[config] Configuration file updated at ${getConfigPath()}`)
    const merged = deepMerge(structuredClone(DEFAULTS), updated)
    return deepFreeze(merged)
}

module.exports = { loadConfig, saveConfig }
