import {fn, spyOn} from 'jest-mock'
import {describe, expect, it} from '@jest/globals'
import * as https from 'https'
import {EventEmitter} from 'events'
import {DEFAULT_SERIES_DATA, MichelBackService, SeriesData} from "./home";
import {Response as ExpressResponse} from 'express'
import Mock = jest.Mock;
import {Logger} from "pino";
import {FaceItClient} from "../lib/faceItClient";
import {createMockHttpsRequest, mockHttpsByUrl} from "../lib/testSupport/mockHttps";

jest.mock('https', () => ({
    get: jest.fn(),
}))

describe('MichelBackService', () => {
    let michelBackService: MichelBackService
    const originalFaceItKey = process.env.FACEIT_KEY
    const originalConfigFilePath = process.env.CONFIGFILE_PATH
    const mockedLogger = {
        debug: fn(),
        error: fn(),
        fatal: fn(),
        info: fn(),
        trace: fn(),
        warn: fn(),
    } as unknown as Logger
    beforeEach(() => {
        ;(global.fetch as any).mockRestore?.()
        process.env.FACEIT_KEY = ''
        process.env.CONFIGFILE_PATH = 'bogus/path' // fake path to force using an inexploitable config file
        michelBackService = new MichelBackService([], false, structuredClone(DEFAULT_SERIES_DATA), mockedLogger)
    })
    afterAll(() => {
        process.env.FACEIT_KEY = originalFaceItKey
        process.env.CONFIGFILE_PATH = originalConfigFilePath
    })
    describe('handleCommand', () => {
        it('should broadcast the updated state to all WebSocket clients after executing a command', () => {
            // setup
            const sendStub: Mock<any, any, any> = fn()
            const connectionPool = [{send: sendStub}, {send: sendStub}]
            const michelBackService = new MichelBackService(connectionPool, false)
            const payloadBuffer: Buffer = Buffer.from('{ "command": "swapTeams" }', 'utf8')
            // action
            michelBackService.handleCommand(payloadBuffer)

            // assert
            expect(sendStub).toHaveBeenCalledTimes(2)
        })
    })
    describe('initialMatchDataFromFaceItMatchId', () => {
        it('should ignore non-string payloads without throwing or hitting the network', async () => {
            // setup
            const res: ExpressResponse = {json: fn()} as unknown as ExpressResponse
            const httpsGetMock = spyOn(https, 'get')
            const malformedPayloads = [
                ['match-id'],
                {matchId: 'match-id'},
                42,
                true,
            ] as unknown as string[]

            // action
            for (const malformedPayload of malformedPayloads) {
                await michelBackService.initialMatchDataFromFaceItMatchId(
                    malformedPayload,
                )
            }

            // assert
            expect(httpsGetMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData()).toEqual(DEFAULT_SERIES_DATA)
            expect(res.json).not.toHaveBeenCalled()
        });
        it('should get team names and logos from the public FaceIt match endpoint', async () => {
            // setup
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
                response.setEncoding = fn()
                callback(response)
                response.emit('data', JSON.stringify(faceItMatchPayload))
                response.emit('end')
                return createMockHttpsRequest()
            }) as any)
            const fetchMock = spyOn(global, 'fetch')

            // action
            const actual = await michelBackService.initialMatchDataFromFaceItMatchId('match-id')

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
            expect(actual).toEqual(
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
                        "tournamentLogo": ""
                    },
                    "faceIt": {
                        "matchId": "match-id",
                        "raw": {
                            "matchCustom": {
                                "tree": {
                                    "heroes": {
                                        "values": {
                                            "value": [
                                                {
                                                    "guid": "0x02E000000000007A",
                                                    "image_lg": "https://assets.faceit-cdn.net/dva.jpeg",
                                                    "name": "DVa"
                                                }
                                            ]
                                        }
                                    }
                                }
                            },
                            "teams": {
                                "faction1": {
                                    "avatar": "https://distribution.faceit-cdn.net/moominhouse.jpg",
                                    "name": "Moominhouse"
                                },
                                "faction2": {
                                    "avatar": "https://distribution.faceit-cdn.net/elmt-thunder.jpg",
                                    "name": "ELMT Thunder"
                                }
                            },
                            "voting": {
                                "heroes": {
                                    "entities": [
                                        {
                                            "guid": "0x02E000000000007A",
                                            "image_lg": "https://assets.faceit-cdn.net/dva.jpeg",
                                            "name": "DVa"
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "standings": {},
                    "team1": {
                        "logo": "https://distribution.faceit-cdn.net/moominhouse.jpg",
                        "name": "Moominhouse",
                        "score": 0
                    },
                    "team2": {
                        "logo": "https://distribution.faceit-cdn.net/elmt-thunder.jpg",
                        "name": "ELMT Thunder",
                        "score": 0
                    }
                }
            )
        })

        it('should fallback to the authenticated FaceIt endpoint when the public endpoint fails and an API key is available', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            const httpsGetMock = mockHttpsByUrl([
                {match: 'www.faceit.com/api/match/v2', statusCode: 418, body: {}},
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
            const actual = await michelBackService.initialMatchDataFromFaceItMatchId('match-id')

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
            expect(actual).toEqual({
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
                    "tournamentLogo": ""
                },
                "faceIt": {
                    "matchId": "match-id",
                    "raw": {
                        "teams": {
                            "faction1": {
                                "avatar": "https://distribution.faceit-cdn.net/auth-alpha.jpg",
                                "name": "Authenticated Alpha"
                            },
                            "faction2": {
                                "avatar": "https://distribution.faceit-cdn.net/auth-bravo.jpg",
                                "name": "Authenticated Bravo"
                            }
                        },
                        "voting": {
                            "heroes": {
                                "entities": [
                                    {
                                        "guid": "hero-guid",
                                        "image_lg": "https://assets.faceit-cdn.net/ana.jpeg",
                                        "name": "Ana"
                                    }
                                ]
                            }
                        }
                    }
                },
                "standings": {},
                "team1": {
                    "logo": "https://distribution.faceit-cdn.net/auth-alpha.jpg",
                    "name": "Authenticated Alpha",
                    "score": 0
                },
                "team2": {
                    "logo": "https://distribution.faceit-cdn.net/auth-bravo.jpg",
                    "name": "Authenticated Bravo",
                    "score": 0
                }
            })
        })

        it('should fallback to the authenticated FaceIt endpoint when the public payload does not contain both teams', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            mockHttpsByUrl([
                {
                    match: 'www.faceit.com/api/match/v2',
                    statusCode: 200,
                    body: {payload: {teams: {faction1: {name: 'Only One Team'}}}},
                },
                {
                    match: 'open.faceit.com/data/v4/matches',
                    statusCode: 200,
                    body: {
                        teams: {
                            faction1: {name: 'Fallback Alpha', avatar: 'fallback-alpha-logo'},
                            faction2: {name: 'Fallback Bravo', avatar: 'fallback-bravo-logo'},
                        },
                    },
                },
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId('match-id')

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
            const res: ExpressResponse = {json: fn()} as unknown as ExpressResponse
            jest.mocked(https.get).mockImplementation(((_, __, callback) => {
                const response = new EventEmitter() as any
                response.statusCode = 418
                callback(response)
                response.emit('data', JSON.stringify({}))
                response.emit('end')
                return createMockHttpsRequest()
            }) as any)
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId('match-id')

            // assert
            expect(fetchMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData()).toEqual(DEFAULT_SERIES_DATA)
            expect(res.json).not.toHaveBeenCalled()
        })

        it('should not update state if both public and authenticated FaceIt endpoints fail', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            const res: ExpressResponse = {json: fn()} as unknown as ExpressResponse
            const httpsGetMock = mockHttpsByUrl([
                {match: 'www.faceit.com/api/match/v2', statusCode: 403, body: {}},
                {match: 'open.faceit.com/data/v4/matches', statusCode: 500, body: {}},
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId('match-id')

            // assert
            expect(httpsGetMock).toHaveBeenCalledTimes(2)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData()).toEqual(DEFAULT_SERIES_DATA)
            expect(res.json).not.toHaveBeenCalled()
        })

        it('should arm a 15s idle timeout on the public request and destroy it when it fires', async () => {
            // setup
            const res: ExpressResponse = {json: fn()} as unknown as ExpressResponse
            let capturedRequest: any
            jest.mocked(https.get).mockImplementation(((_, __, ___) => {
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
            await michelBackService.initialMatchDataFromFaceItMatchId('match-id')

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
            const res: ExpressResponse = {json: fn()} as unknown as ExpressResponse
            // Public endpoint fails cleanly, then the authenticated request goes
            // idle and fires 'timeout'; the shared https.get idle-timeout funnel
            // must turn that into a rejection that leaves state untouched.
            const httpsGetMock = mockHttpsByUrl([
                {match: 'www.faceit.com/api/match/v2', statusCode: 418, body: {}},
                {match: 'open.faceit.com/data/v4/matches', statusCode: 200, body: {}, timeout: true},
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId('match-id')

            // assert
            expect(httpsGetMock).toHaveBeenCalledTimes(2)
            expect(fetchMock).not.toHaveBeenCalled()
            expect(michelBackService.getSeriesData()).toEqual(DEFAULT_SERIES_DATA)
            expect(res.json).not.toHaveBeenCalled()
        })

        it('should fall back to the authenticated endpoint when the public request times out and a key is available', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            const httpsGetMock = mockHttpsByUrl([
                {match: 'www.faceit.com/api/match/v2', statusCode: 200, body: {}, timeout: true},
                {
                    match: 'open.faceit.com/data/v4/matches',
                    statusCode: 200,
                    body: {
                        teams: {
                            faction1: {name: 'Timeout Alpha', avatar: 'timeout-alpha-logo'},
                            faction2: {name: 'Timeout Bravo', avatar: 'timeout-bravo-logo'},
                        },
                    },
                },
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action
            await michelBackService.initialMatchDataFromFaceItMatchId('match-id')

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
            ;(global.fetch as any).mockRestore?.()
            // mockedLogger is shared across the suite; clear accumulated calls so
            // "was not called with" assertions in this block can't see prior tests.
            Object.values(mockedLogger as unknown as Record<string, Mock>).forEach((level) => level.mockClear?.())
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
                {match: 'www.faceit.com/api/democracy/v1', statusCode: 418, body: {}},
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
            expect(errorSpy).toHaveBeenCalledWith({
                msg: 'Could not update lobby data using FaceIt match id match-id',
                error: 'Response status not 200 : 418'
            })
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

        it('should still call next when the fetched payload contains no tickets (hence no hero ban votes) AND should NOT throw a ban retrieval error', async () => {
            // setup
            const nextMock = fn()
            const getMock = mockHttpsByUrl([
                {
                    match: 'www.faceit.com/api/democracy/v1',
                    statusCode: 200,
                    body: {
                        payload: {},
                    },
                },
            ])
            // action
            await michelBackService.updatedLobbyDataFromFaceItMatchId('match-id', 1, nextMock)
            // assert
            expect(getMock).toHaveBeenCalledWith('https://www.faceit.com/api/democracy/v1/match/match-id/history', {
                "headers": {
                    "Accept": "application/json",
                    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36",
                }}, expect.any(Function)
            )
            expect(nextMock).toHaveBeenCalled()
            expect(mockedLogger.error).not.toHaveBeenCalledWith(expect.objectContaining({
                msg: 'Error fetching faceit match details (bans)'
            }))
            expect({...michelBackService.getSeriesData().standings}).toStrictEqual({})
        })

        // The history endpoint tells us WHICH heroes were banned (their guids)
        // but only carries guids, not the display data. The hero images/names
        // live in faceIt.raw.voting.heroes.entities, which is populated by the
        // initial match lookup. When that data is missing, the code re-triggers
        // the lookup; the ban standings can only be filled in once that async
        // lookup has RESOLVED. This guards that the lookup is awaited: the ban
        // display data can only come from the (deferred) match/v2 refetch, so
        // it can never appear unless we waited for it.
        it('should populate ban standings with the hero data loaded by the awaited refetch', async () => {
            // setup
            const historyPayload = {
                payload: {
                    tickets: [
                        {
                            entity_type: 'heroes',
                            entities: [
                                {status: 'drop', guid: '1234', selected_by: 'faction1'},
                                {status: 'drop', guid: '4567', selected_by: 'faction2'},
                            ],
                        },
                    ],
                },
            }
            // The match/v2 refetch is the SOLE source of the hero images/names.
            // We hold its resolution behind a deferred promise so the test can
            // prove the standings are only written after that refetch settles.
            const matchDataPayload = {
                payload: {
                    teams: {
                        faction1: {name: 'Moominhouse', avatar: 'moomin-logo'},
                        faction2: {name: 'ELMT Thunder', avatar: 'elmt-logo'},
                    },
                    matchCustom: {
                        tree: {
                            heroes: {
                                values: {
                                    value: [
                                        {guid: '1234', name: 'DVa', image_lg: 'dva-image-from-refetch'},
                                        {guid: '4567', name: 'Ana', image_lg: 'ana-image-from-refetch'},
                                    ],
                                },
                            },
                        },
                    },
                },
            }

            let releaseMatchData: () => void = () => {
            }
            const matchDataReleased = new Promise<void>((resolve) => {
                releaseMatchData = resolve
            })
            let standingsAtMatchV2CallTime: SeriesData['standings'] | undefined

            jest.mocked(https.get).mockImplementation(((url: string, _options: any, callback: any) => {
                const request = createMockHttpsRequest()
                const emitResponse = (body: unknown) => {
                    const response = new EventEmitter() as any
                    response.setEncoding = fn()
                    response.statusCode = 200
                    callback(response)
                    response.emit('data', JSON.stringify(body))
                    response.emit('end')
                }
                if (url.includes('democracy/v1')) {
                    emitResponse(historyPayload)
                    return request
                }
                if (url.includes('match/v2')) {
                    // Capture the standings at the moment the refetch is issued:
                    // if the await is missing, standings would already have been
                    // (wrongly) written by then. With the await, they are still empty.
                    standingsAtMatchV2CallTime = structuredClone(michelBackService.getSeriesData().standings)
                    matchDataReleased.then(() => emitResponse(matchDataPayload))
                    return request
                }
                throw new Error(`unexpected FaceIt URL in test: ${url}`)
            }) as any)

            const nextMock = fn()

            // action
            const lobbyUpdate = michelBackService.updatedLobbyDataFromFaceItMatchId('match-id', 1, nextMock)
            // since we should be waiting for a data refetch from `initialMatchDataFromFaceItMatchId`,
            // it should not be possible for the function to have already called `next`
            expect(nextMock).not.toHaveBeenCalled()
            releaseMatchData()
            await lobbyUpdate

            // assert
            // now that we've simulated the data refetch,
            // we can check that the series data has been correctly updated (and that `next` was called)
            expect(standingsAtMatchV2CallTime).toEqual({})
            expect(nextMock).toHaveBeenCalledTimes(1)
            expect(michelBackService.getSeriesData().standings).toEqual({
                match1: {
                    bans: {
                        team1: {heroImage: 'dva-image-from-refetch', heroName: 'DVa'},
                        team2: {heroImage: 'ana-image-from-refetch', heroName: 'Ana'},
                    },
                },
            })
        })
        it('should log an error and call `next` if any error got thrown during the retrieval process', async () => {
            // setup
            const nextMock = fn()
            jest.spyOn((michelBackService as any).faceItClient, 'getLobbyHistory').mockResolvedValue({})
            jest.spyOn((michelBackService as any).faceItClient, 'hasBanVotesForMap').mockImplementation(() => {
                throw new Error('Foo Bar Baz Error')
            })
            // action
            await michelBackService.updatedLobbyDataFromFaceItMatchId('match-id', 1, nextMock)

            // assert
            expect(nextMock).toHaveBeenCalledTimes(1)
            expect(mockedLogger.error).toHaveBeenCalledWith({
                msg: 'Error fetching faceit match details (bans)',
                error: 'Foo Bar Baz Error'
            })
        })

        it('should keep series data that are not bans and just replace bans when called (in the event FaceIt data has already been initialized before)', async () => {
            // setup
            const nextMock = fn()
            const seriesData = michelBackService.getSeriesData()
            seriesData.faceIt = {
                matchId: '',
                raw: {
                    voting: {
                        heroes: {
                            entities: [{}]
                        }
                    }
                }
            }
            seriesData.standings[`match1`] = {
                bans: {
                    team1: {
                        heroImage: 'dva.jpeg',
                        heroName: 'DVa',
                    },
                    team2: {
                        heroImage: 'soldier.jpeg',
                        heroName: 'Soldier 76',
                    }
                },
                map: {
                    selectedBy: 'team1',
                    image: 'suravasa.jpeg',
                    name: 'Suravasa'
                }
            }
            jest.spyOn((michelBackService as any).faceItClient, 'getLobbyHistory').mockResolvedValue({})
            jest.spyOn((michelBackService as any).faceItClient, 'hasBanVotesForMap').mockReturnValue(true)
            jest.spyOn((michelBackService as any).faceItClient, 'extractBansForMap').mockReturnValue(
                {
                    team1: {heroImage: 'emre.jpeg', heroName: 'Emre'},
                    team2: {heroImage: 'domina.jpeg', heroName: 'Domina'}
                }
            )

            // action
            await michelBackService.updatedLobbyDataFromFaceItMatchId('match-id', 1, nextMock)

            // assert
            expect(seriesData.standings[`match1`]).toStrictEqual(
                {
                    bans: {
                        team1: {
                            heroImage: 'emre.jpeg',
                            heroName: 'Emre',
                        },
                        team2: {
                            heroImage: 'domina.jpeg',
                            heroName: 'Domina',
                        }
                    },
                    map: {
                        selectedBy: 'team1',
                        image: 'suravasa.jpeg',
                        name: 'Suravasa'
                    }
                }
            )
        })
    })
    describe('teamUpdateBan', () => {
        let michelBackService: MichelBackService
        beforeEach(() => {
            michelBackService = new MichelBackService([], false)
        })
        it('should update Team1 ban for round 2 if current round is 2 and selected team is team 1', () => {
            // setup
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
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(1)
            // action
            michelBackService.teamUpdateBan('team1', 'Foo')
            // assert
            expect(michelBackService.getSeriesData().standings).toEqual(expectedUpdatedStandings)
        })

        it('should update Team2 ban for round 2 if current round is 2 and selected team is team 2', () => {
            // setup
            // const michelBackService = new MichelBackService([], false)
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
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(1)
            // action
            michelBackService.teamUpdateBan('team2', 'Bar')
            // assert
            expect(michelBackService.getSeriesData().standings).toEqual(expectedUpdatedStandings)
        })
    })
    describe('teamIncrementScore', () => {
        it('should increment team1 score by 2 if `team1` is selected increment is 2', () => {
            // setup / action
            michelBackService.teamIncrementScore('team1', 2)
            // assert
            expect(michelBackService.getSeriesData().team1.score).toStrictEqual(2)
        })
        it('should not allow a team score to be negative', () => {
            // setup / action
            michelBackService.teamIncrementScore('team1', -2)
            // assert
            expect(michelBackService.getSeriesData().team1.score).toStrictEqual(0)
        })
    })
    describe('broadcastState', () => {
        it('should send a message through the connection pool with the current seriesData to all connected clients (WebSocket)', () => {
            // setup
            const sendStub = fn()
            const connectionPool = [
                {send: sendStub},
                {send: sendStub}
            ]
            const michelBackService = new MichelBackService(connectionPool, false)
            // action
            michelBackService.broadcastState()
            // assert
            expect(sendStub).toHaveBeenCalledTimes(2)
        })
    })
    describe('teamUpdateName', () => {
        it('should correctly update team1 name if provided name is `team1`', () => {
            // setup / action
            michelBackService.teamUpdateName('team1', 'new team name')
            // assert
            expect(michelBackService.getSeriesData().team1.name).toStrictEqual('new team name')
            expect(michelBackService.getSeriesData().team2.name).toStrictEqual('')
        })
        it('should correctly update team2 name if provided name is `team2`', () => {
            // setup / action
            michelBackService.teamUpdateName('team2', 'new team name')
            // assert
            expect(michelBackService.getSeriesData().team1.name).toStrictEqual('')
            expect(michelBackService.getSeriesData().team2.name).toStrictEqual('new team name')
        })
        it('should NOT update any team name if provided name is neither `team1` nor `team2`', () => {
            // setup / action
            michelBackService.teamUpdateName('foo', 'new team name')
            // assert
            expect(michelBackService.getSeriesData().team1.name).toStrictEqual('')
            expect(michelBackService.getSeriesData().team2.name).toStrictEqual('')
        })
    })
    describe('updateTeamLogo', () => {
        it('should correctly update team1 name if provided name is `team1`', () => {
            // setup / action
            michelBackService.updateTeamLogo('team1', 'new team logo')
            // assert
            expect(michelBackService.getSeriesData().team1.logo).toStrictEqual('new team logo')
            expect(michelBackService.getSeriesData().team2.logo).toStrictEqual('')
        })
        it('should correctly update team2 name if provided name is `team2`', () => {
            // setup / action
            michelBackService.updateTeamLogo('team2', 'new team logo')
            // assert
            expect(michelBackService.getSeriesData().team1.logo).toStrictEqual('')
            expect(michelBackService.getSeriesData().team2.logo).toStrictEqual('new team logo')
        })
        it('should NOT update any team name if provided name is neither `team1` nor `team2`', () => {
            // setup / action
            michelBackService.updateTeamLogo('foo', 'new team logo')
            // assert
            expect(michelBackService.getSeriesData().team1.logo).toStrictEqual('')
            expect(michelBackService.getSeriesData().team2.logo).toStrictEqual('')
        })
    })
    describe('swapTeams', () => {
        it('should swap right and left display values', () => {
            // setup
            const michelBackService = new MichelBackService([], false)
            // action
            michelBackService.swapTeams()
            // assert
            // Default: right = 'team1', left = 'team2' so should be flipped after calling `swapTeams`
            expect(michelBackService.getSeriesData().display.right).toStrictEqual('team2')
            expect(michelBackService.getSeriesData().display.left).toStrictEqual('team1')
        })

        it('should restore original values when called twice', () => {
            // setup
            const michelBackService = new MichelBackService([], false)

            // action
            michelBackService.swapTeams()
            michelBackService.swapTeams()

            // assert
            expect(michelBackService.getSeriesData().display.right).toStrictEqual('team1')
            expect(michelBackService.getSeriesData().display.left).toStrictEqual('team2')
        })
    })
    describe('setMapCount', () => {
        it('should set mapCount to the provided value', () => {
            michelBackService.setMapCount(4)
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(4)
        })

        it('should coerce a numeric string to a number', () => {
            michelBackService.setMapCount('3')
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(3)
        })

        it('should clamp to a minimum of 1 for zero / negative input', () => {
            michelBackService.setMapCount(-7)
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(1)
            michelBackService.setMapCount(0)
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(1)
        })

        it('should floor non-integer values', () => {
            michelBackService.setMapCount(3.9)
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(3)
        })

        it('should leave mapCount untouched and still broadcast when the value is unparseable', () => {
            const michelBackService = new MichelBackService([], false)
            michelBackService.setMapCount('not-a-number')
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(1)
        })

        it('should NOT trigger any FaceIt fetch even when standings are missing for the target map', () => {
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                faceIt: {matchId: 'some-id'},
            })
            const fetchSpy = spyOn(svc, 'fetchFaceItMatchUpdates').mockImplementation(() => Promise.resolve())
            svc.setMapCount(5)
            expect(fetchSpy).not.toHaveBeenCalled()
        })
    })
    describe('catchup', () => {
        it('should be a no-op when given a non-object payload', () => {
            const broadcastSpy = spyOn(michelBackService, 'broadcastState').mockImplementation(() => {
            })
            michelBackService.catchup(null)
            michelBackService.catchup('string')
            michelBackService.catchup([1, 2])
            expect(michelBackService.getSeriesData()).toEqual(DEFAULT_SERIES_DATA)
        })

        it('should apply tournamentLogo and mapCount when they differ from current state', () => {
            michelBackService.catchup({tournamentLogo: 'https://logo', mapCount: 4})
            expect(michelBackService.getSeriesData().display.tournamentLogo).toStrictEqual('https://logo')
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(4)
        })

        it('should NOT trigger a FaceIt fetch when faceItMatchId is unchanged', () => {
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                faceIt: {matchId: 'same-id'},
            })
            const fetchSpy = spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            svc.catchup({faceItMatchId: 'same-id'})
            expect(fetchSpy).not.toHaveBeenCalled()
        })

        it('should trigger a FaceIt fetch when faceItMatchId changes to a non-empty value', () => {
            const fetchSpy = spyOn(michelBackService, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            michelBackService.catchup({faceItMatchId: 'new-match-id'})
            expect(fetchSpy).toHaveBeenCalledWith('new-match-id')
            expect(michelBackService.getSeriesData().faceIt.matchId).toStrictEqual('new-match-id')
        })

        it('should clear matchId without triggering a FaceIt fetch when payload sets it to empty string', () => {
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                faceIt: {matchId: 'previous-id'},
            })
            const fetchSpy = spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            svc.catchup({faceItMatchId: ''})
            expect(fetchSpy).not.toHaveBeenCalled()
            expect(svc.getSeriesData().faceIt.matchId).toStrictEqual('')
        })

        it('should apply team names, logos and scores when the back is at defaults', () => {
            michelBackService.catchup({
                team1: {name: 'Alpha', score: 2, logo: 'https://alpha.png'},
                team2: {name: 'Bravo', score: 1, logo: 'https://bravo.png'},
            })
            expect(michelBackService.getSeriesData().team1).toMatchObject({name: 'Alpha', score: 2, logo: 'https://alpha.png'})
            expect(michelBackService.getSeriesData().team2).toMatchObject({name: 'Bravo', score: 1, logo: 'https://bravo.png'})
        })

        it('should skip team1/team2 name catchup when matchId triggers a FaceIt fetch', () => {
            spyOn(michelBackService, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            michelBackService.catchup({
                faceItMatchId: 'new-match-id',
                team1: {name: 'FrontAlpha'},
                team2: {name: 'FrontBravo'},
            })
            // Names are left at defaults so the FaceIt response (which the
            // mock skips here, but in production overwrites them) wins.
            expect(michelBackService.getSeriesData().team1.name).toStrictEqual('')
            expect(michelBackService.getSeriesData().team2.name).toStrictEqual('')
        })

        it('should skip team1/team2 logo catchup when matchId triggers a FaceIt fetch', () => {
            spyOn(michelBackService, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            michelBackService.catchup({
                faceItMatchId: 'new-match-id',
                team1: {logo: 'https://front-alpha.png'},
                team2: {logo: 'https://front-bravo.png'},
            })
            expect(michelBackService.getSeriesData().team1.logo).toStrictEqual('')
            expect(michelBackService.getSeriesData().team2.logo).toStrictEqual('')
        })

        it('should still apply team scores even when matchId triggers a FaceIt fetch', async () => {
            // FaceIt does not provide scores, so the front-cached scores
            // must still be honored under the normal back-at-default gate.
            spyOn(michelBackService, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            await michelBackService.catchup({
                faceItMatchId: 'new-match-id',
                team1: {name: 'FrontAlpha', score: 3},
                team2: {name: 'FrontBravo', score: 2},
            })
            const data = michelBackService.getSeriesData()
            // Names skipped (FaceIt will overwrite), scores applied.
            expect(data.team1.name).toStrictEqual('')
            expect(data.team2.name).toStrictEqual('')
            expect(data.team1.score).toStrictEqual(3)
            expect(data.team2.score).toStrictEqual(2)
        })

        it('should NOT overwrite team logos already set on the back', () => {
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                team1: {name: '', score: 0, logo: 'existing-team1-logo'},
                team2: {name: '', score: 0, logo: ''},
            })
            svc.catchup({
                team1: {logo: 'front-team1-logo'},
                team2: {logo: 'front-team2-logo'},
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
                faceIt: {matchId: 'same-id'},
            })
            spyOn(svc, 'initialMatchDataFromFaceItMatchId').mockImplementation(() => undefined as any)
            svc.catchup({
                faceItMatchId: 'same-id',
                team1: {name: 'Alpha', logo: 'alpha-logo'},
                team2: {name: 'Bravo', logo: 'bravo-logo'},
            })
            const data = svc.getSeriesData()
            expect(data.team1).toMatchObject({name: 'Alpha', logo: 'alpha-logo'})
            expect(data.team2).toMatchObject({name: 'Bravo', logo: 'bravo-logo'})
        })

        it('should NOT overwrite team names/scores already mutated on the back', () => {
            const svc = new MichelBackService([], false, {
                ...structuredClone(DEFAULT_SERIES_DATA),
                team1: {name: 'Existing', score: 5, logo: ''},
                team2: {name: '', score: 3, logo: ''},
            })
            svc.catchup({
                team1: {name: 'FromFront', score: 9},
                team2: {name: 'FromFront', score: 9},
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
            michelBackService.catchup({
                team1: {name: '', score: 0},
                team2: {name: '', score: 0},
            })
            const data = michelBackService.getSeriesData()
            expect(data.team1.name).toStrictEqual('')
            expect(data.team1.score).toStrictEqual(0)
            expect(data.team2.name).toStrictEqual('')
            expect(data.team2.score).toStrictEqual(0)
        })

        it('should be wired into handleCommand', () => {
            const catchupSpy = spyOn(michelBackService, 'catchup').mockResolvedValue({
                team1: {
                    name: "",
                    score: 0,
                    logo: ""
                },
                team2: {
                    name: "",
                    score: 0,
                    logo: ""
                },
                faceIt: {
                    matchId: ""
                },
                standings: {},
                display: {
                    right: "",
                    left: "",
                    mapCount: 0,
                    customCounter: 0,
                    mapFormat: "FT1",
                    tournamentLogo: "",
                    optionalLogoDisplay: false
                }
            })
            michelBackService.handleCommand(Buffer.from(JSON.stringify({command: 'catchup', value: {mapCount: 5}})))
            expect(catchupSpy).toHaveBeenCalledWith({mapCount: 5})
        })

        it('should wire setMapCount through handleCommand', () => {
            const setSpy = spyOn(michelBackService, 'setMapCount').mockImplementation(() => {
            })
            michelBackService.handleCommand(Buffer.from(JSON.stringify({command: 'setMapCount', value: 7})))
            expect(setSpy).toHaveBeenCalledWith(7)
        })

        const MATCH_ID = '1-9f898257-b66c-4a72-9295-1b6aef2cb672'

        // Per-URL extraction is exhaustively unit-tested on FaceItClient.extractMatchId.
        // Here we only guard the WIRING: the service must hand the extracted id to the
        // FaceIt client rather than the raw room URL it received.
        it('should extract the match id from a room url and pass it to the FaceIt client', async () => {
            // setup
            const faceItClient = {
                getNormalizedMatchData: fn(async () => ({raw: {}, team1: {}, team2: {}})),
                getLobbyHistory: fn(),
                extractBansForMap: fn(),
                hasBanVotesForMap: fn(),
            } as unknown as FaceItClient
            const svc = new MichelBackService([], false, undefined, mockedLogger, faceItClient)
            // action
            await svc.initialMatchDataFromFaceItMatchId(`https://www.faceit.com/en/ow2/room/${MATCH_ID}/scoreboard?foo=bar`)
            // assert
            expect(faceItClient.getNormalizedMatchData).toHaveBeenCalledWith(MATCH_ID)
        })

        const seriesDataWithStaleStandings = (): SeriesData => ({
            ...structuredClone(DEFAULT_SERIES_DATA),
            standings: {
                match1: {bans: {team1: {heroImage: 'stale-hero'} as any, team2: {} as any}}
            }
        })

        it('should wipe stale standings from a previous match once the new match data resolves', async () => {
            // setup
            const faceItClient = {
                getNormalizedMatchData: fn(async () => ({raw: {}, team1: {name: 'A'}, team2: {name: 'B'}})),
            } as unknown as FaceItClient
            const svc = new MichelBackService([], false, seriesDataWithStaleStandings(), mockedLogger, faceItClient)
            jest.spyOn(svc, 'broadcastState').mockImplementation(() => {
            })
            // action
            await svc.initialMatchDataFromFaceItMatchId(MATCH_ID)
            // assert
            expect(svc.getSeriesData().standings).toEqual({})
        })

        it('should wipe stale standings even when the new match fetch fails', async () => {
            // setup
            const faceItClient = {
                getNormalizedMatchData: fn(async () => {
                    throw new Error('fetch failed')
                }),
            } as unknown as FaceItClient
            const svc = new MichelBackService([], false, seriesDataWithStaleStandings(), mockedLogger, faceItClient)
            jest.spyOn(svc, 'broadcastState').mockImplementation(() => {
            })
            // action
            await svc.initialMatchDataFromFaceItMatchId(MATCH_ID)
            // assert
            expect(svc.getSeriesData().standings).toEqual({})
        })
    })
    describe('updateMapCountAndRefreshFaceItDataIfNeeded', () => {
        it('should increment the mapCount by the provided counter', () => {
            // setup / action
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(2)
            // assert
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(3)
        })
        it('should prevent updating the map counter to a map# below 1', () => {
            // setup / action
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(-3)
            // assert
            expect(michelBackService.getSeriesData().display.mapCount).toStrictEqual(1)
        })
        it('should attempt to load FaceIt data if there is FaceIt configuration and it mentions a matchRoom Id', () => {
            // setup
            const fetchFaceItMatchUpdatesStub = spyOn(michelBackService, "fetchFaceItMatchUpdates").mockImplementation(() => Promise.resolve())
            // action
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(1)
            // assert
            expect(fetchFaceItMatchUpdatesStub).toHaveBeenCalledWith(2)
        })
        it('should not attempt to load FaceIt data if round has already been loaded and just return existing data', () => {
            // setup
            const michelBackService = new MichelBackService([], false, {
                ...DEFAULT_SERIES_DATA,
                standings: {match2: {bans: {team1: {}, team2: {}}}}
            })

            const fetchFaceItMatchUpdatesStub = spyOn(michelBackService, "broadcastState").mockImplementation(() => {
            })
            // action
            michelBackService.updateMapCountAndRefreshFaceItDataIfNeeded(1)
            // assert
            expect(fetchFaceItMatchUpdatesStub).not.toHaveBeenCalled()
        })
    })
    describe('service constructor', () => {
        it('should not replace series data from configuration file if series data were explicitly provided to the constructor', () => {
            // setup / action
            const michelBackService = new MichelBackService([], false, DEFAULT_SERIES_DATA)
            // assert
            expect(michelBackService.getSeriesData()).toStrictEqual(DEFAULT_SERIES_DATA)
        })
    })
})
