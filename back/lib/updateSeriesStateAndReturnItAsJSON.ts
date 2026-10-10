import {Request, Response} from 'express'
import {SeriesData} from '../handlers/home.js'

/**
 * Builds the Express handler factory that runs a (possibly asynchronous)
 * service call, sends its resolved {@link SeriesData} as the JSON response,
 * and only then broadcasts the updated state to connected clients.
 *
 * Awaiting the service call is what keeps asynchronous mutations (e.g. the
 * FaceIt-refreshing map-count updates) honest: the response carries the real
 * post-mutation state and the broadcast fires after the state has settled.
 */
export const makeUpdateSeriesStateAndReturnItAsJSON =
    (broadcastState: () => void) =>
    (serviceCall: () => SeriesData | Promise<SeriesData>) =>
    async (_: Request, res: Response): Promise<void> => {
        res.json(await serviceCall())
        broadcastState()
    }
