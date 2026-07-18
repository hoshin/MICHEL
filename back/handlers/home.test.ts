import {fn, spyOn} from 'jest-mock'
import {describe, expect, it} from '@jest/globals'
import * as https from 'https'
import {EventEmitter} from 'events'
import {DEFAULT_SERIES_DATA, MichelBackService} from "./home";
import {Response as ExpressResponse} from 'express'
import Mock = jest.Mock;

jest.mock('https', () => ({
    get: fn(),
}))

// Mirrors the slice of https.ClientRequest the production code relies on: it
// is an EventEmitter (for 'error'/'timeout') augmented with setTimeout and
// destroy. destroy(err) re-emits 'error' with that error, exactly like Node's
// real ClientRequest, so the single request.on('error', reject) funnel in the
// source turns an idle timeout into a rejection.
const createMockHttpsRequest = () => {
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
type CannedHttpsResponse = {
    statusCode: number
    body: unknown
    timeout?: boolean
}
const mockHttpsByUrl = (routes: Array<{ match: string } & CannedHttpsResponse>) =>
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

describe('MichelBackService', () => {
    let michelBackService: MichelBackService
    const originalFaceItKey = process.env.FACEIT_KEY

    describe('initialMatchDataFromFaceItMatchId', () => {
        beforeEach(() => {
            const connectionPool = []
            jest.restoreAllMocks()
            ;(global.fetch as any).mockRestore?.()
            jest.mocked(https.get).mockReset()
            process.env.FACEIT_KEY = ''
            michelBackService = new MichelBackService(connectionPool, false)
        })

        afterAll(() => {
            process.env.FACEIT_KEY = originalFaceItKey
        })

        it('should get team names and logos from the public FaceIt match endpoint', async () => {
            // setup
            const res: ExpressResponse = { json: fn() } as unknown as ExpressResponse
            const faceItMatchPayload = {
                payload: {
                    teams: {
                        faction1: {
                            name: 'Moominhouse',
                            avatar: 'https://distribution.faceit-cdn.net/moominhouse.jpg',
                        },
                        faction2: {
                            name: 'ELMT Thunder',
                            avatar: 'https://distribution.faceit-cdn.net/elmt-thunder.jpg',
                        },
                    },
                    matchCustom: {
                        tree: {
                            heroes: {
                                values: {
                                    value: [
                                        {
                                            guid: '0x02E000000000007A',
                                            name: 'DVa',
                                            image_lg: 'https://assets.faceit-cdn.net/dva.jpeg',
                                        },
                                    ],
                                },
                            },
                        },
                    },
                },
            }
            const httpsGetMock = jest.mocked(https.get).mockImplementation(((url, options, callback) => {
                const response = new EventEmitter() as any
                response.statusCode = 200
                callback(response)
                response.emit('data', JSON.stringify(faceItMatchPayload))
                response.emit('end')
                return createMockHttpsRequest()
            }) as any)
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId(res, 'match-id')

            // assert
            expect(httpsGetMock).toHaveBeenCalledWith('https://www.faceit.com/api/match/v2/match/match-id', {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
                },
            }, expect.any(Function))
            expect(michelBackService.getSeriesData().team1).toMatchObject({
                name: 'Moominhouse',
                logo: 'https://distribution.faceit-cdn.net/moominhouse.jpg',
            })
            expect(michelBackService.getSeriesData().team2).toMatchObject({
                name: 'ELMT Thunder',
                logo: 'https://distribution.faceit-cdn.net/elmt-thunder.jpg',
            })
            expect(michelBackService.getSeriesData().faceIt.matchId).toStrictEqual('match-id')
            expect(michelBackService.getSeriesData().faceIt.raw.voting.heroes.entities).toEqual([
                {
                    guid: '0x02E000000000007A',
                    name: 'DVa',
                    image_lg: 'https://assets.faceit-cdn.net/dva.jpeg',
                },
            ])
            expect(fetchMock).not.toHaveBeenCalled()
            expect(res.json).toHaveBeenCalledWith(michelBackService.getSeriesData())
        })

        it('should fallback to the authenticated FaceIt endpoint when the public endpoint fails and an API key is available', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            const res: ExpressResponse = { json: fn() } as unknown as ExpressResponse
            const httpsGetMock = mockHttpsByUrl([
                { match: 'www.faceit.com/api/match/v2', statusCode: 418, body: {} },
                {
                    match: 'open.faceit.com/data/v4/matches',
                    statusCode: 200,
                    body: {
                        teams: {
                            faction1: {
                                name: 'Authenticated Alpha',
                                avatar: 'https://distribution.faceit-cdn.net/auth-alpha.jpg',
                            },
                            faction2: {
                                name: 'Authenticated Bravo',
                                avatar: 'https://distribution.faceit-cdn.net/auth-bravo.jpg',
                            },
                        },
                        voting: {
                            heroes: {
                                entities: [
                                    {
                                        guid: 'hero-guid',
                                        name: 'Ana',
                                        image_lg: 'https://assets.faceit-cdn.net/ana.jpeg',
                                    },
                                ],
                            },
                        },
                    },
                },
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId(res, 'match-id')

            // assert
            expect(httpsGetMock).toHaveBeenCalledWith('https://www.faceit.com/api/match/v2/match/match-id', {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
                },
            }, expect.any(Function))
            expect(httpsGetMock).toHaveBeenCalledWith('https://open.faceit.com/data/v4/matches/match-id', {
                headers: {
                    Accept: 'application/json',
                    Authorization: 'Bearer faceit-api-key',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
                },
            }, expect.any(Function))
            expect(fetchMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData().team1).toMatchObject({
                name: 'Authenticated Alpha',
                logo: 'https://distribution.faceit-cdn.net/auth-alpha.jpg',
            })
            expect(michelBackService.getSeriesData().team2).toMatchObject({
                name: 'Authenticated Bravo',
                logo: 'https://distribution.faceit-cdn.net/auth-bravo.jpg',
            })
            expect(michelBackService.getSeriesData().faceIt.raw.voting.heroes.entities).toEqual([
                {
                    guid: 'hero-guid',
                    name: 'Ana',
                    image_lg: 'https://assets.faceit-cdn.net/ana.jpeg',
                },
            ])
            expect(res.json).toHaveBeenCalledWith(michelBackService.getSeriesData())
        })

        it('should fallback to the authenticated FaceIt endpoint when the public payload does not contain both teams', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            const res: ExpressResponse = { json: fn() } as unknown as ExpressResponse
            mockHttpsByUrl([
                {
                    match: 'www.faceit.com/api/match/v2',
                    statusCode: 200,
                    body: { payload: { teams: { faction1: { name: 'Only One Team' } } } },
                },
                {
                    match: 'open.faceit.com/data/v4/matches',
                    statusCode: 200,
                    body: {
                        teams: {
                            faction1: { name: 'Fallback Alpha', avatar: 'fallback-alpha-logo' },
                            faction2: { name: 'Fallback Bravo', avatar: 'fallback-bravo-logo' },
                        },
                    },
                },
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId(res, 'match-id')

            // assert
            expect(fetchMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData().team1).toMatchObject({
                name: 'Fallback Alpha',
                logo: 'fallback-alpha-logo',
            })
            expect(michelBackService.getSeriesData().team2).toMatchObject({
                name: 'Fallback Bravo',
                logo: 'fallback-bravo-logo',
            })
        })

        it('should not update state if the public FaceIt match endpoint fails and no API key is available', async () => {
            // setup
            const res: ExpressResponse = { json: fn() } as unknown as ExpressResponse
            jest.mocked(https.get).mockImplementation(((url, options, callback) => {
                const response = new EventEmitter() as any
                response.statusCode = 418
                callback(response)
                response.emit('data', JSON.stringify({}))
                response.emit('end')
                return createMockHttpsRequest()
            }) as any)
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId(res, 'match-id')

            // assert
            expect(fetchMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData()).toEqual(DEFAULT_SERIES_DATA)
            expect(res.json).not.toHaveBeenCalled()
        })

        it('should not update state if both public and authenticated FaceIt endpoints fail', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            const res: ExpressResponse = { json: fn() } as unknown as ExpressResponse
            const httpsGetMock = mockHttpsByUrl([
                { match: 'www.faceit.com/api/match/v2', statusCode: 403, body: {} },
                { match: 'open.faceit.com/data/v4/matches', statusCode: 500, body: {} },
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId(res, 'match-id')

            // assert
            expect(httpsGetMock).toHaveBeenCalledTimes(2)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData()).toEqual(DEFAULT_SERIES_DATA)
            expect(res.json).not.toHaveBeenCalled()
        })

        it('should arm a 15s idle timeout on the public request and destroy it when it fires', async () => {
            // setup
            const res: ExpressResponse = { json: fn() } as unknown as ExpressResponse
            let capturedRequest: any
            jest.mocked(https.get).mockImplementation(((url, options, callback) => {
                capturedRequest = createMockHttpsRequest()
                // Simulate FaceIt accepting the connection but never responding:
                // the socket goes idle and the request emits 'timeout'. Deferred
                // so the source has wired its 'timeout' listener by the time it
                // fires (the listener is attached after https.get returns).
                setImmediate(() => capturedRequest.emit('timeout'))
                return capturedRequest
            }) as any)
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId(res, 'match-id')

            // assert
            expect(capturedRequest.setTimeout).toHaveBeenCalledWith(15000)
            expect(capturedRequest.destroy).toHaveBeenCalledWith(new Error('FaceIt request timed out after 15000 ms'))
            expect(fetchMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData()).toEqual(DEFAULT_SERIES_DATA)
            expect(res.json).not.toHaveBeenCalled()
        })

        it('should not update state if the authenticated fallback request times out', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            const res: ExpressResponse = { json: fn() } as unknown as ExpressResponse
            // Public endpoint fails cleanly, then the authenticated request goes
            // idle and fires 'timeout'; the shared https.get idle-timeout funnel
            // must turn that into a rejection that leaves state untouched.
            const httpsGetMock = mockHttpsByUrl([
                { match: 'www.faceit.com/api/match/v2', statusCode: 418, body: {} },
                { match: 'open.faceit.com/data/v4/matches', statusCode: 200, body: {}, timeout: true },
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId(res, 'match-id')

            // assert
            expect(httpsGetMock).toHaveBeenCalledTimes(2)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData()).toEqual(DEFAULT_SERIES_DATA)
            expect(res.json).not.toHaveBeenCalled()
        })

        it('should fall back to the authenticated endpoint when the public request times out and a key is available', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            const res: ExpressResponse = { json: fn() } as unknown as ExpressResponse
            const httpsGetMock = mockHttpsByUrl([
                { match: 'www.faceit.com/api/match/v2', statusCode: 200, body: {}, timeout: true },
                {
                    match: 'open.faceit.com/data/v4/matches',
                    statusCode: 200,
                    body: {
                        teams: {
                            faction1: { name: 'Timeout Alpha', avatar: 'timeout-alpha-logo' },
                            faction2: { name: 'Timeout Bravo', avatar: 'timeout-bravo-logo' },
                        },
                    },
                },
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId(res, 'match-id')

            // assert
            expect(httpsGetMock).toHaveBeenCalledTimes(2)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData().team1).toMatchObject({
                name: 'Timeout Alpha',
                logo: 'timeout-alpha-logo',
            })
            expect(michelBackService.getSeriesData().team2).toMatchObject({
                name: 'Timeout Bravo',
                logo: 'timeout-bravo-logo',
            })
        })
    })

    describe('updatedLobbyDataFromFaceItMatchId', () => {
        beforeEach(() => {
            const connectionPool = []
            jest.restoreAllMocks()
            ;(global.fetch as any).mockRestore?.()
            jest.mocked(https.get).mockReset()
            michelBackService = new MichelBackService(connectionPool, false)
        })

        it('should not try and fetch anything if no matchId is provided', async () => {
            // setup
            const nextMock = fn()
            // action
            await michelBackService.updatedLobbyDataFromFaceItMatchId(undefined, 1, nextMock)
            // assert
            expect(nextMock).not.toHaveBeenCalled()
        })
        it('should log an error and return if matchId is provided but the request fails', async () => {
            // setup
            const nextMock = fn()
            const httpsGetMock = mockHttpsByUrl([
                { match: 'www.faceit.com/api/democracy/v1', statusCode: 418, body: {} },
            ])
            const errorSpy = spyOn((michelBackService as any).logger, 'error').mockImplementation(() => {
            })
            // action
            await michelBackService.updatedLobbyDataFromFaceItMatchId('match-id', 1, nextMock)
            // assert
            expect(httpsGetMock).toHaveBeenCalledWith('https://www.faceit.com/api/democracy/v1/match/match-id/history', {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36',
                },
            }, expect.any(Function))
            expect(errorSpy).toHaveBeenCalledWith({ msg: 'Could not update lobby data using FaceIt match id match-id', error: 'Response status not 200 : 418'})
            expect(nextMock).toHaveBeenCalled()
        })
        it('should still call next when the votes for the map have no entities', async () => {
            // setup
            const nextMock = fn()
            mockHttpsByUrl([
                {
                    match: 'www.faceit.com/api/democracy/v1',
                    statusCode: 200,
                    body: {
                        payload: {
                            tickets: [
                                {
                                    entity_type: 'heroes',
                                    entities: [],
                                },
                            ],
                        },
                    },
                },
            ])
            // action
            await michelBackService.updatedLobbyDataFromFaceItMatchId('match-id', 1, nextMock)
            // assert
            expect(nextMock).toHaveBeenCalled()
        })
    })
    describe('teamUpdateBan', () => {
        it('should update Team1 ban for round 2 if current round is 2 and selected team is team 1', () => {
            // setup
            const michelBackService = new MichelBackService([], false)
            const expectedUpdatedStandings = {
                "match2": {
                    "bans": {
                        "team1": {
                            "heroImage": "Foo",
                        },
                        "team2": {},
                    },
                },

            }
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(null,1)
            // action
            michelBackService.teamUpdateBan(null, 'team1', 'Foo')
            // assert
            expect(michelBackService.getSeriesData().standings).toEqual(expectedUpdatedStandings)
        })

        it('should update Team2 ban for round 2 if current round is 2 and selected team is team 2', () => {
            // setup
            const michelBackService = new MichelBackService([], false)
            const expectedUpdatedStandings = {
                "match2": {
                    "bans": {
                        "team1": {},
                        "team2": {
                            "heroImage": "Bar",
                        },
                    },
                },
            }
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(null,1)
            // action
            michelBackService.teamUpdateBan(null, 'team2', 'Bar')
            // assert
            expect(michelBackService.getSeriesData().standings).toEqual(expectedUpdatedStandings)
        })
    })
    describe('teamIncrementScore', () => {
        it('should increment team1 score by 2 if `team1` is selected increment is 2', () => {
            // setup
            const michelBackService = new MichelBackService([], false)

            // action
            michelBackService.teamIncrementScore(null, 'team1', 2)
            // assert
            expect(michelBackService.getSeriesData().team1.score).toStrictEqual(2)
        })
        it('should not allow a team score to be negative', () => {
            // setup
            const michelBackService = new MichelBackService([], false)

            // action
            michelBackService.teamIncrementScore(null, 'team1', -2)
            // assert
            expect(michelBackService.getSeriesData().team1.score).toStrictEqual(0)
        })
    })
    describe('sendUpdatedStateToCaller', () => {
        it('should return the current seriesData to the caller if a Response object was provided (regular REST call)', () => {
            // setup
            const michelBackService = new MichelBackService([], false)
            const res: ExpressResponse = {
                json: fn()
            } as unknown as ExpressResponse
            // action
            michelBackService.sendUpdatedStateToCaller(res)
            // assert
            expect(res.json).toHaveBeenCalledWith(
                {
                    "display": {
                        "countdown": 0,
                        "countdownColor": "",
                        "countdownRunning": false,
                        "customCounter": 0,
                        "left": "team2",
                        "mapCount": 1,
                        "mapFormat": "FT3",
                        "optionalLogoDisplay": true,
                        "right": "team1",
                        "tournamentLogo": "",
                    },
                    "faceIt": {
                        "matchId": "",
                    },
                    "standings": {},
                    "team1": {
                        "logo": "",
                        "name": "",
                        "score": 0,
                    },
                    "team2": {
                        "logo": "",
                        "name": "",
                        "score": 0,
                    },
                }
            )
        })
        it('should send a message through the connection pool with the current seriesData to all connected clients (WebSocket)', () => {
            // setup
            const sendStub = fn()
            const connectionPool = [
                {send: sendStub},
                {send: sendStub}
            ]
            const michelBackService = new MichelBackService(connectionPool, false)
            const expectedResponse = JSON.stringify({
                "display": {
                    "countdown": 0,
                    "countdownColor": "",
                    "countdownRunning": false,
                    "customCounter": 0,
                    "left": "team2",
                    "mapCount": 1,
                    "mapFormat": "FT3",
                    "optionalLogoDisplay": true,
                    "right": "team1",
                    "tournamentLogo": "",
                },
                "faceIt": {
                    "matchId": "",
                },
                "standings": {},
                "team1": {
                    "logo": "",
                    "name": "",
                    "score": 0,
                },
                "team2": {
                    "logo": "",
                    "name": "",
                    "score": 0,
                },
            })
            // action
            michelBackService.sendUpdatedStateToCaller(null)
            // assert
            expect(sendStub).toHaveBeenCalledTimes(2)
        })
    })
    describe('teamUpdateName', () => {
        it('should correctly update team1 name if provided name is `team1`', () => {
            // setup
            const michelBackService = new MichelBackService([], false)

            // action
            michelBackService.teamUpdateName(null, 'team1', 'new team name')
            // assert
            expect(michelBackService.getSeriesData().team1.name).toStrictEqual('new team name')
            expect(michelBackService.getSeriesData().team2.name).toStrictEqual('')
        })
        it('should correctly update team2 name if provided name is `team2`', () => {
            // setup
            const michelBackService = new MichelBackService([], false)

            // action
            michelBackService.teamUpdateName(null, 'team2', 'new team name')
            // assert
            expect(michelBackService.getSeriesData().team1.name).toStrictEqual('')
            expect(michelBackService.getSeriesData().team2.name).toStrictEqual('new team name')
        })
        it('should NOT update any team name if provided name is neither `team1` nor `team2`', () => {
            // setup
            const michelBackService = new MichelBackService([], false)

            // action
            michelBackService.teamUpdateName(null, 'foo', 'new team name')
            // assert
            expect(michelBackService.getSeriesData().team1.name).toStrictEqual('')
            expect(michelBackService.getSeriesData().team2.name).toStrictEqual('')
        })
    })

    describe('updateTeamLogo', () => {
        it('should correctly update team1 name if provided name is `team1`', () => {
            // setup
            const michelBackService = new MichelBackService([], false)

            // action
            michelBackService.updateTeamLogo(null, 'team1', 'new team logo')
            // assert
            expect(michelBackService.getSeriesData().team1.logo).toStrictEqual('new team logo')
            expect(michelBackService.getSeriesData().team2.logo).toStrictEqual('')
        })
        it('should correctly update team2 name if provided name is `team2`', () => {
            // setup
            const michelBackService = new MichelBackService([], false)

            // action
            michelBackService.updateTeamLogo(null, 'team2', 'new team logo')
            // assert
            expect(michelBackService.getSeriesData().team1.logo).toStrictEqual('')
            expect(michelBackService.getSeriesData().team2.logo).toStrictEqual('new team logo')
        })
        it('should NOT update any team name if provided name is neither `team1` nor `team2`', () => {
            // setup
            const michelBackService = new MichelBackService([], false)

            // action
            michelBackService.updateTeamLogo(null, 'foo', 'new team logo')
            // assert
            expect(michelBackService.getSeriesData().team1.logo).toStrictEqual('')
            expect(michelBackService.getSeriesData().team2.logo).toStrictEqual('')
        })
    })
    describe('swapTeams', () => {
        it('should swap right and left display values', () => {
            // setup
            const michelBackService = new MichelBackService([], false)
            // Default: right = 'team1', left = 'team2'

            // action
            michelBackService.swapTeams(null)

            // assert
            expect(michelBackService.getSeriesData().display.right).toStrictEqual('team2')
            expect(michelBackService.getSeriesData().display.left).toStrictEqual('team1')
        })

        it('should restore original values when called twice', () => {
            // setup
            const michelBackService = new MichelBackService([], false)

            // action
            michelBackService.swapTeams(null)
            michelBackService.swapTeams(null)

            // assert
            expect(michelBackService.getSeriesData().display.right).toStrictEqual('team1')
            expect(michelBackService.getSeriesData().display.left).toStrictEqual('team2')
        })

        it('should call sendUpdatedStateToCaller with the provided response', () => {
            // setup
            const michelBackService = new MichelBackService([], false)
            const sendUpdatedStateStub = jest.spyOn(michelBackService, 'sendUpdatedStateToCaller').mockImplementation(() => {})
            const res: ExpressResponse = { json: fn() } as unknown as ExpressResponse

            // action
            michelBackService.swapTeams(res)

            // assert
            expect(sendUpdatedStateStub).toHaveBeenCalledWith(res)
        })

        it('should broadcast the updated state to all WebSocket clients after swapping', () => {
            // setup
            const sendStub: Mock<any, any, any> = fn()
            const connectionPool = [{ send: sendStub }, { send: sendStub }]
            const michelBackService = new MichelBackService(connectionPool, false)

            // action
            michelBackService.swapTeams(null)

            // assert
            expect(sendStub).toHaveBeenCalledTimes(2)
            const sentPayload = JSON.parse(sendStub.mock.calls[0][0])
            expect(sentPayload.display.right).toStrictEqual('team2')
            expect(sentPayload.display.left).toStrictEqual('team1')
        })
    })

    describe('setMapCount', () => {
        it('should set mapCount to the provided value', () => {
            const svc = new MichelBackService([], false)
            svc.setMapCount(null, 4)
            expect(svc.getSeriesData().display.mapCount).toStrictEqual(4)
        })

        it('should coerce a numeric string to a number', () => {
            const svc = new MichelBackService([], false)
            svc.setMapCount(null, '3')
            expect(svc.getSeriesData().display.mapCount).toStrictEqual(3)
        })

        it('should clamp to a minimum of 1 for zero / negative input', () => {
            const svc = new MichelBackService([], false)
            svc.setMapCount(null, -7)
            expect(svc.getSeriesData().display.mapCount).toStrictEqual(1)
            svc.setMapCount(null, 0)
            expect(svc.getSeriesData().display.mapCount).toStrictEqual(1)
        })

        it('should floor non-integer values', () => {
            const svc = new MichelBackService([], false)
            svc.setMapCount(null, 3.9)
            expect(svc.getSeriesData().display.mapCount).toStrictEqual(3)
        })

        it('should leave mapCount untouched and still broadcast when the value is unparseable', () => {
            const svc = new MichelBackService([], false)
            const broadcastSpy = jest.spyOn(svc, 'sendUpdatedStateToCaller').mockImplementation(() => {})
            svc.setMapCount(null, 'not-a-number')
            expect(svc.getSeriesData().display.mapCount).toStrictEqual(1)
            expect(broadcastSpy).toHaveBeenCalledTimes(1)
        })

        it('should NOT trigger any FaceIt fetch even when standings are missing for the target map', () => {
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                faceIt: { matchId: 'some-id' },
            })
            const fetchSpy = jest.spyOn(svc, 'fetchFaceItMatchUpdates').mockImplementation(() => {})
            svc.setMapCount(null, 5)
            expect(fetchSpy).not.toHaveBeenCalled()
        })
    })

    describe('catchup', () => {
        it('should be a no-op (just broadcast) when given a non-object payload', () => {
            const svc = new MichelBackService([], false)
            const broadcastSpy = jest.spyOn(svc, 'sendUpdatedStateToCaller').mockImplementation(() => {})
            svc.catchup(null, null)
            svc.catchup(null, 'string')
            svc.catchup(null, [1, 2])
            expect(broadcastSpy).toHaveBeenCalledTimes(3)
            expect(svc.getSeriesData()).toEqual(DEFAULT_SERIES_DATA)
        })

        it('should apply tournamentLogo and mapCount when they differ from current state', () => {
            const svc = new MichelBackService([], false)
            svc.catchup(null, { tournamentLogo: 'https://logo', mapCount: 4 })
            expect(svc.getSeriesData().display.tournamentLogo).toStrictEqual('https://logo')
            expect(svc.getSeriesData().display.mapCount).toStrictEqual(4)
        })

        it('should NOT trigger a FaceIt fetch when faceItMatchId is unchanged', () => {
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                faceIt: { matchId: 'same-id' },
            })
            const fetchSpy = jest.spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            svc.catchup(null, { faceItMatchId: 'same-id' })
            expect(fetchSpy).not.toHaveBeenCalled()
        })

        it('should trigger a FaceIt fetch when faceItMatchId changes to a non-empty value', () => {
            const svc = new MichelBackService([], false)
            const fetchSpy = jest.spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            svc.catchup(null, { faceItMatchId: 'new-match-id' })
            expect(fetchSpy).toHaveBeenCalledWith(null, 'new-match-id')
            expect(svc.getSeriesData().faceIt.matchId).toStrictEqual('new-match-id')
        })

        it('should clear matchId without triggering a FaceIt fetch when payload sets it to empty string', () => {
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                faceIt: { matchId: 'previous-id' },
            })
            const fetchSpy = jest.spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            svc.catchup(null, { faceItMatchId: '' })
            expect(fetchSpy).not.toHaveBeenCalled()
            expect(svc.getSeriesData().faceIt.matchId).toStrictEqual('')
        })

        it('should apply team names, logos and scores when the back is at defaults', () => {
            const svc = new MichelBackService([], false)
            svc.catchup(null, {
                team1: { name: 'Alpha', score: 2, logo: 'https://alpha.png' },
                team2: { name: 'Bravo', score: 1, logo: 'https://bravo.png' },
            })
            expect(svc.getSeriesData().team1).toMatchObject({ name: 'Alpha', score: 2, logo: 'https://alpha.png' })
            expect(svc.getSeriesData().team2).toMatchObject({ name: 'Bravo', score: 1, logo: 'https://bravo.png' })
        })

        it('should skip team1/team2 name catchup when matchId triggers a FaceIt fetch', () => {
            const svc = new MichelBackService([], false)
            jest.spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            svc.catchup(null, {
                faceItMatchId: 'new-match-id',
                team1: { name: 'FrontAlpha' },
                team2: { name: 'FrontBravo' },
            })
            // Names are left at defaults so the FaceIt response (which the
            // mock skips here, but in production overwrites them) wins.
            expect(svc.getSeriesData().team1.name).toStrictEqual('')
            expect(svc.getSeriesData().team2.name).toStrictEqual('')
        })

        it('should skip team1/team2 logo catchup when matchId triggers a FaceIt fetch', () => {
            const svc = new MichelBackService([], false)
            jest.spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            svc.catchup(null, {
                faceItMatchId: 'new-match-id',
                team1: { logo: 'https://front-alpha.png' },
                team2: { logo: 'https://front-bravo.png' },
            })
            expect(svc.getSeriesData().team1.logo).toStrictEqual('')
            expect(svc.getSeriesData().team2.logo).toStrictEqual('')
        })

        it('should still apply team scores even when matchId triggers a FaceIt fetch', () => {
            // FaceIt does not provide scores, so the front-cached scores
            // must still be honored under the normal back-at-default gate.
            const svc = new MichelBackService([], false)
            jest.spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            svc.catchup(null, {
                faceItMatchId: 'new-match-id',
                team1: { name: 'FrontAlpha', score: 3 },
                team2: { name: 'FrontBravo', score: 2 },
            })
            const data = svc.getSeriesData()
            // Names skipped (FaceIt will overwrite), scores applied.
            expect(data.team1.name).toStrictEqual('')
            expect(data.team2.name).toStrictEqual('')
            expect(data.team1.score).toStrictEqual(3)
            expect(data.team2.score).toStrictEqual(2)
        })

        it('should NOT overwrite team logos already set on the back', () => {
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                team1: { name: '', score: 0, logo: 'existing-team1-logo' },
                team2: { name: '', score: 0, logo: '' },
            })
            svc.catchup(null, {
                team1: { logo: 'front-team1-logo' },
                team2: { logo: 'front-team2-logo' },
            })
            const data = svc.getSeriesData()
            // team1.logo was non-default -> kept; team2.logo was default -> applied.
            expect(data.team1.logo).toStrictEqual('existing-team1-logo')
            expect(data.team2.logo).toStrictEqual('front-team2-logo')
        })

        it('should apply team names and logos when no matchId fetch is triggered', () => {
            // matchId is the same as the back's current value -> no fetch
            // triggered, names/logos honor the normal back-at-default gate.
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                faceIt: { matchId: 'same-id' },
            })
            jest.spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            svc.catchup(null, {
                faceItMatchId: 'same-id',
                team1: { name: 'Alpha', logo: 'alpha-logo' },
                team2: { name: 'Bravo', logo: 'bravo-logo' },
            })
            const data = svc.getSeriesData()
            expect(data.team1).toMatchObject({ name: 'Alpha', logo: 'alpha-logo' })
            expect(data.team2).toMatchObject({ name: 'Bravo', logo: 'bravo-logo' })
        })

        it('should NOT overwrite team names/scores already mutated on the back', () => {
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                team1: { name: 'Existing', score: 5, logo: '' },
                team2: { name: '', score: 3, logo: '' },
            })
            svc.catchup(null, {
                team1: { name: 'FromFront', score: 9 },
                team2: { name: 'FromFront', score: 9 },
            })
            const data = svc.getSeriesData()
            // team1.name stays 'Existing', team1.score stays 5
            expect(data.team1.name).toStrictEqual('Existing')
            expect(data.team1.score).toStrictEqual(5)
            // team2.name was at default '' -> applied; team2.score was 3 -> kept
            expect(data.team2.name).toStrictEqual('FromFront')
            expect(data.team2.score).toStrictEqual(3)
        })

        it('should ignore meaningless team payloads (empty name, zero score)', () => {
            const svc = new MichelBackService([], false)
            svc.catchup(null, {
                team1: { name: '', score: 0 },
                team2: { name: '', score: 0 },
            })
            const data = svc.getSeriesData()
            expect(data.team1.name).toStrictEqual('')
            expect(data.team1.score).toStrictEqual(0)
            expect(data.team2.name).toStrictEqual('')
            expect(data.team2.score).toStrictEqual(0)
        })

        it('should broadcast exactly once when no FaceIt fetch is triggered', () => {
            const svc = new MichelBackService([], false)
            const broadcastSpy = jest.spyOn(svc, 'sendUpdatedStateToCaller').mockImplementation(() => {})
            svc.catchup(null, { tournamentLogo: 'logo', mapCount: 3 })
            expect(broadcastSpy).toHaveBeenCalledTimes(1)
        })

        it('should skip the trailing local broadcast when a FaceIt fetch is triggered', () => {
            const svc = new MichelBackService([], false)
            jest.spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            const broadcastSpy = jest.spyOn(svc, 'sendUpdatedStateToCaller').mockImplementation(() => {})
            svc.catchup(null, { faceItMatchId: 'new-id', tournamentLogo: 'logo' })
            expect(broadcastSpy).not.toHaveBeenCalled()
        })

        it('should be wired into handleCommand', () => {
            const svc = new MichelBackService([], false)
            const catchupSpy = jest.spyOn(svc, 'catchup').mockImplementation(() => {})
            svc.handleCommand(Buffer.from(JSON.stringify({ command: 'catchup', value: { mapCount: 5 } })))
            expect(catchupSpy).toHaveBeenCalledWith(null, { mapCount: 5 })
        })

        it('should wire setMapCount through handleCommand', () => {
            const svc = new MichelBackService([], false)
            const setSpy = jest.spyOn(svc, 'setMapCount').mockImplementation(() => {})
            svc.handleCommand(Buffer.from(JSON.stringify({ command: 'setMapCount', value: 7 })))
            expect(setSpy).toHaveBeenCalledWith(null, 7)
        })
    })

    describe('updateMapCountAndRefreshFaceItDataIfNeeded', () => {
        it('should increment the mapCount by the provided counter', () => {
            // setup
            const michelBackService = new MichelBackService([], false)
            // action
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(null, 2)
            // assert
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(3)
        })
        it('should prevent updating the map counter to a map# below 1', () => {
            // setup
            const michelBackService = new MichelBackService([], false)
            // action
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(null, -3)
            // assert
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(1)
        })
        it('should attempt to load FaceIt data if there is FaceIt configuration and it mentions a matchRoom Id', () => {
            // setup
            const michelBackService = new MichelBackService([], false)
            const fetchFaceItMatchUpdatesStub = jest.spyOn(michelBackService, "fetchFaceItMatchUpdates").mockImplementation(() => {})
            // action
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(null, 1)
            // assert
            expect(fetchFaceItMatchUpdatesStub).toHaveBeenCalledWith(null, 2)
        })
        it('should not attempt to load FaceIt data if round has already been loaded and just return existing data', () => {
            // setup
            const michelBackService = new MichelBackService([], false, {...DEFAULT_SERIES_DATA, standings:{ match2: { bans:{ team1: {}, team2: {}}}}})

            const fetchFaceItMatchUpdatesStub = jest.spyOn(michelBackService, "sendUpdatedStateToCaller").mockImplementation(() => {})
            // action
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(null, 1)
            // assert
            expect(fetchFaceItMatchUpdatesStub).toHaveBeenCalledWith(null)
        })
    })
})
