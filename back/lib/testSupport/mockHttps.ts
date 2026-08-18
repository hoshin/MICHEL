import {fn} from 'jest-mock'
import {EventEmitter} from 'events'
import * as https from 'https'

// Mirrors the slice of https.ClientRequest the production code relies on: it
// is an EventEmitter (for 'error'/'timeout') augmented with setTimeout and
// destroy. destroy(err) re-emits 'error' with that error, exactly like Node's
// real ClientRequest, so the single request.on('error', reject) funnel in the
// source turns an idle timeout into a rejection.
export const createMockHttpsRequest = () => {
    const request = new EventEmitter() as any
    request.setTimeout = fn()
    request.destroy = fn((error?: Error) => {
        if (error) {
            request.emit('error', error)
        }
    })
    return request
}

// After consolidating every FaceIt call onto https.get, a single test may see
// several https.get invocations to different hosts (public match endpoint then
// the authenticated fallback). This routes each call to a canned response
// keyed by a substring of the URL, so tests stay declarative instead of
// hand-rolling call-count branching inside the mock.
export type CannedHttpsResponse = {
    statusCode: number
    body: unknown
    timeout?: boolean
}

export const mockHttpsByUrl = (routes: Array<{ match: string } & CannedHttpsResponse>) =>
    jest.mocked(https.get).mockImplementation(((url: string, _options: any, callback: any) => {
        const route = routes.find((candidate) => url.includes(candidate.match))
        if (!route) {
            throw new Error(`mockHttpsByUrl: no canned response for ${url}`)
        }
        const request = createMockHttpsRequest()
        if (route.timeout) {
            setImmediate(() => request.emit('timeout'))
            return request
        }
        const response = new EventEmitter() as any
        response.statusCode = route.statusCode
        callback(response)
        response.emit('data', typeof route.body === 'string' ? route.body : JSON.stringify(route.body))
        response.emit('end')
        return request
    }) as any)
