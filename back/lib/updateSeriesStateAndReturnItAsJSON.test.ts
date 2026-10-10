import {fn} from 'jest-mock'
import {describe, expect, it} from '@jest/globals'
import {Request, Response} from 'express'
import {SeriesData} from '../handlers/home'
import {makeUpdateSeriesStateAndReturnItAsJSON} from './updateSeriesStateAndReturnItAsJSON'

const aSeriesData = (marker: string) => ({marker} as unknown as SeriesData)

const aResponse = () => {
    const json = fn()
    return {response: {json} as unknown as Response, json}
}

describe('makeUpdateSeriesStateAndReturnItAsJSON', () => {
    it('should respond with the value returned by a synchronous service call', async () => {
        // setup
        const broadcast = fn()
        const seriesData = aSeriesData('sync')
        const {response, json} = aResponse()
        const handler = makeUpdateSeriesStateAndReturnItAsJSON(broadcast)(() => seriesData)
        // action
        await handler({} as Request, response)
        // assert
        expect(json).toHaveBeenCalledWith(seriesData)
    })

    it('should respond with the resolved value of an asynchronous service call', async () => {
        // setup
        const broadcast = fn()
        const seriesData = aSeriesData('async')
        const {response, json} = aResponse()
        const handler = makeUpdateSeriesStateAndReturnItAsJSON(broadcast)(async () => seriesData)
        // action
        await handler({} as Request, response)
        // assert
        expect(json).toHaveBeenCalledWith(seriesData)
    })

    it('should broadcast the state only after the asynchronous service call has resolved', async () => {
        // setup
        const callOrder: string[] = []
        const broadcast = fn(() => {
            callOrder.push('broadcast')
        })
        const {response} = aResponse()
        const serviceCall = async () => {
            await Promise.resolve()
            callOrder.push('serviceCall')
            return aSeriesData('async')
        }
        const handler = makeUpdateSeriesStateAndReturnItAsJSON(broadcast)(serviceCall)
        // action
        await handler({} as Request, response)
        // assert
        expect(callOrder).toEqual(['serviceCall', 'broadcast'])
    })
})
