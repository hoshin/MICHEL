const { fn } = require('jest-mock')
const { describe, expect, it } = require('@jest/globals')
const { applyLinuxGtkWorkaround } = require('./gtk')

describe('applyLinuxGtkWorkaround', () => {
    it('should force GTK version 3 on Linux so the packaged app can launch', () => {
        // setup
        const appendSwitchMock = fn()
        const appMock = { commandLine: { appendSwitch: appendSwitchMock } }
        // action
        applyLinuxGtkWorkaround(appMock, 'linux')
        // assert
        expect(appendSwitchMock).toHaveBeenCalledWith('gtk-version', '3')
    })

    it('should not append the GTK switch on Windows', () => {
        // setup
        const appendSwitchMock = fn()
        const appMock = { commandLine: { appendSwitch: appendSwitchMock } }
        // action
        applyLinuxGtkWorkaround(appMock, 'win32')
        // assert
        expect(appendSwitchMock).not.toHaveBeenCalled()
    })

    it('should not append the GTK switch on macOS', () => {
        // setup
        const appendSwitchMock = fn()
        const appMock = { commandLine: { appendSwitch: appendSwitchMock } }
        // action
        applyLinuxGtkWorkaround(appMock, 'darwin')
        // assert
        expect(appendSwitchMock).not.toHaveBeenCalled()
    })
})
