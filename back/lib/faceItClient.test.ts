import {fn, spyOn} from 'jest-mock'
import {describe, expect, it, beforeEach, afterAll} from '@jest/globals'
import * as https from 'https'
import {EventEmitter} from 'events'
import {Logger} from 'pino'
import {FaceItClient} from './faceItClient'
import {createMockHttpsRequest, mockHttpsByUrl} from './testSupport/mockHttps'

jest.mock('https', () => ({
    get: jest.fn(),
}))

const BROWSER_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

const mockedLogger = {
    debug: fn(),
    error: fn(),
    fatal: fn(),
    info: fn(),
    trace: fn(),
    warn: fn(),
} as unknown as Logger

describe('FaceItClient', () => {
    const originalFaceItKey = process.env.FACEIT_KEY

    describe('extractMatchId', () => {
        const MATCH_ID = '1-9f898257-b66c-4a72-9295-1b6aef2cb672'

        it('should extract the match id from a FaceIt room url', () => {
            expect(FaceItClient.extractMatchId(`https://www.faceit.com/en/ow2/room/${MATCH_ID}`)).toBe(MATCH_ID)
        })
        it('should return a bare match id unchanged', () => {
            expect(FaceItClient.extractMatchId(MATCH_ID)).toBe(MATCH_ID)
        })
        it('should extract the match id from a url with a trailing slash', () => {
            expect(FaceItClient.extractMatchId(`https://www.faceit.com/en/ow2/room/${MATCH_ID}/`)).toBe(MATCH_ID)
        })
        it('should extract the match id from a url with a scoreboard suffix', () => {
            expect(FaceItClient.extractMatchId(`https://www.faceit.com/en/ow2/room/${MATCH_ID}/scoreboard`)).toBe(MATCH_ID)
        })
        it('should extract the match id from a url carrying a query string', () => {
            expect(FaceItClient.extractMatchId(`https://www.faceit.com/en/ow2/room/${MATCH_ID}?foo=bar`)).toBe(MATCH_ID)
        })
        it('should extract the match id from a url carrying a hash fragment', () => {
            expect(FaceItClient.extractMatchId(`https://www.faceit.com/en/ow2/room/${MATCH_ID}#scoreboard`)).toBe(MATCH_ID)
        })
    })

    describe('getNormalizedMatchData', () => {
        let client: FaceItClient
        beforeEach(() => {
            jest.restoreAllMocks()
            ;(global.fetch as any).mockRestore?.()
            jest.mocked(https.get).mockReset()
            process.env.FACEIT_KEY = 'some-key'
            client = new FaceItClient({logger: mockedLogger})
        })

        afterAll(() => {
            if (originalFaceItKey !== undefined) {
                process.env.FACEIT_KEY = originalFaceItKey
            }
        })

        it('should read team names, logos and hero entities from the public endpoint using https.get (not fetch)', async () => {
            // setup
            const faceItMatchPayload = {
                payload: {
                    teams: {
                        faction1: {name: 'Moominhouse', avatar: 'https://distribution.faceit-cdn.net/moominhouse.jpg'},
                        faction2: {
                            name: 'ELMT Thunder',
                            avatar: 'https://distribution.faceit-cdn.net/elmt-thunder.jpg'
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
                                            image_lg: 'https://assets.faceit-cdn.net/dva.jpeg'
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
            const matchData = await client.getNormalizedMatchData('match-id')

            // assert
            expect(httpsGetMock).toHaveBeenCalledWith('https://www.faceit.com/api/match/v2/match/match-id', {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': BROWSER_USER_AGENT,
                },
            }, expect.any(Function))
            expect(matchData.team1).toMatchObject({
                name: 'Moominhouse',
                avatar: 'https://distribution.faceit-cdn.net/moominhouse.jpg'
            })
            expect(matchData.team2).toMatchObject({
                name: 'ELMT Thunder',
                avatar: 'https://distribution.faceit-cdn.net/elmt-thunder.jpg'
            })
            expect(matchData.raw.voting.heroes.entities).toEqual([
                {guid: '0x02E000000000007A', name: 'DVa', image_lg: 'https://assets.faceit-cdn.net/dva.jpeg'},
            ])
            expect(fetchMock).not.toHaveBeenCalled()
        })

        it('should fall back to the authenticated endpoint when the public endpoint fails and a key is available', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            client = new FaceItClient({logger: mockedLogger})
            const httpsGetMock = mockHttpsByUrl([
                {match: 'www.faceit.com/api/match/v2', statusCode: 418, body: {}},
                {
                    match: 'open.faceit.com/data/v4/matches',
                    statusCode: 200,
                    body: {
                        teams: {
                            faction1: {
                                name: 'Authenticated Alpha',
                                avatar: 'https://distribution.faceit-cdn.net/auth-alpha.jpg'
                            },
                            faction2: {
                                name: 'Authenticated Bravo',
                                avatar: 'https://distribution.faceit-cdn.net/auth-bravo.jpg'
                            },
                        },
                        voting: {
                            heroes: {
                                entities: [{
                                    guid: 'hero-guid',
                                    name: 'Ana',
                                    image_lg: 'https://assets.faceit-cdn.net/ana.jpeg'
                                }]
                            }
                        },
                    },
                },
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action
            const matchData = await client.getNormalizedMatchData('match-id')

            // assert
            expect(httpsGetMock).toHaveBeenCalledWith('https://www.faceit.com/api/match/v2/match/match-id', {
                headers: {Accept: 'application/json', 'User-Agent': BROWSER_USER_AGENT},
            }, expect.any(Function))
            expect(httpsGetMock).toHaveBeenCalledWith('https://open.faceit.com/data/v4/matches/match-id', {
                headers: {
                    Accept: 'application/json',
                    Authorization: 'Bearer faceit-api-key',
                    'User-Agent': BROWSER_USER_AGENT
                },
            }, expect.any(Function))
            expect(fetchMock).not.toHaveBeenCalled()
            expect(matchData.team1).toMatchObject({
                name: 'Authenticated Alpha',
                avatar: 'https://distribution.faceit-cdn.net/auth-alpha.jpg'
            })
            expect(matchData.team2).toMatchObject({
                name: 'Authenticated Bravo',
                avatar: 'https://distribution.faceit-cdn.net/auth-bravo.jpg'
            })
            expect(matchData.raw.voting.heroes.entities).toEqual([{
                guid: 'hero-guid',
                name: 'Ana',
                image_lg: 'https://assets.faceit-cdn.net/ana.jpeg'
            }])
        })

        it('should fall back to the authenticated endpoint when the public payload lacks both teams', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            client = new FaceItClient({logger: mockedLogger})
            mockHttpsByUrl([
                {
                    match: 'www.faceit.com/api/match/v2',
                    statusCode: 200,
                    body: {payload: {teams: {faction1: {name: 'Only One Team'}}}}
                },
                {
                    match: 'open.faceit.com/data/v4/matches',
                    statusCode: 200,
                    body: {
                        teams: {
                            faction1: {name: 'Fallback Alpha', avatar: 'fallback-alpha-logo'},
                            faction2: {name: 'Fallback Bravo', avatar: 'fallback-bravo-logo'}
                        }
                    },
                },
            ])

            // action
            const matchData = await client.getNormalizedMatchData('match-id')

            // assert
            expect(matchData.team1).toMatchObject({name: 'Fallback Alpha', avatar: 'fallback-alpha-logo'})
            expect(matchData.team2).toMatchObject({name: 'Fallback Bravo', avatar: 'fallback-bravo-logo'})
        })

        it('should reject when the public endpoint fails and no API key is available', async () => {
            // setup
            delete process.env.FACEIT_KEY
            mockHttpsByUrl([
                {match: 'www.faceit.com/api/match/v2', statusCode: 418, body: {}},
            ])
            const fetchMock = spyOn(global, 'fetch')

            // action / assert
            await expect(client.getNormalizedMatchData('match-id')).rejects.toThrow('No FaceIt API key available for authenticated fallback')
            expect(fetchMock).not.toHaveBeenCalled()
            if (originalFaceItKey !== undefined) {
                process.env.FACEIT_KEY = originalFaceItKey
            }
        })

        it('should reject when both public and authenticated endpoints fail', async () => {
            // setup
            process.env.FACEIT_KEY = 'faceit-api-key'
            client = new FaceItClient({logger: mockedLogger})
            const httpsGetMock = mockHttpsByUrl([
                {match: 'www.faceit.com/api/match/v2', statusCode: 403, body: {}},
                {match: 'open.faceit.com/data/v4/matches', statusCode: 500, body: {}},
            ])

            // action / assert
            await expect(client.getNormalizedMatchData('match-id')).rejects.toThrow('Response status not 200 : 500')
            expect(httpsGetMock).toHaveBeenCalledTimes(2)
        })

        it('should arm a 15s idle timeout and destroy the request when it fires', async () => {
            // setup
            let capturedRequest: any
            jest.mocked(https.get).mockImplementation(((_, __, ___) => {
                capturedRequest = createMockHttpsRequest()
                setImmediate(() => capturedRequest.emit('timeout'))
                return capturedRequest
            }) as any)

            // action / assert
            await expect(client.getNormalizedMatchData('match-id')).rejects.toThrow()
            expect(capturedRequest.setTimeout).toHaveBeenCalledWith(15000)
            expect(capturedRequest.destroy).toHaveBeenCalledWith(new Error('FaceIt request timed out after 15000 ms'))
        })
    })

    describe('getLobbyHistory', () => {
        let client: FaceItClient
        beforeEach(() => {
            jest.restoreAllMocks()
            jest.mocked(https.get).mockReset()
            delete process.env.FACEIT_KEY
            client = new FaceItClient({logger: mockedLogger})
        })

        afterAll(() => {
            if (originalFaceItKey !== undefined) {
                process.env.FACEIT_KEY = originalFaceItKey
            }
        })

        it('should GET the democracy history endpoint with the browser headers', async () => {
            // setup
            const historyPayload = {payload: {tickets: []}}
            const httpsGetMock = mockHttpsByUrl([
                {match: 'www.faceit.com/api/democracy/v1', statusCode: 200, body: historyPayload},
            ])

            // action
            const history = await client.getLobbyHistory('match-id')

            // assert
            expect(httpsGetMock).toHaveBeenCalledWith('https://www.faceit.com/api/democracy/v1/match/match-id/history', {
                headers: {Accept: 'application/json', 'User-Agent': BROWSER_USER_AGENT},
            }, expect.any(Function))
            expect(history).toEqual(historyPayload)
        })

        it('should reject when the history endpoint fails', async () => {
            // setup
            mockHttpsByUrl([
                {match: 'www.faceit.com/api/democracy/v1', statusCode: 418, body: {}},
            ])

            // action / assert
            await expect(client.getLobbyHistory('match-id')).rejects.toThrow('Response status not 200 : 418')
        })
    })

    describe('extractBansForMap', () => {
        const client = new FaceItClient({logger: mockedLogger})
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
        const heroEntities = [
            {guid: '1234', name: 'DVa', image_lg: 'dva-image'},
            {guid: '4567', name: 'Ana', image_lg: 'ana-image'},
        ]

        it('should return both team bans when history and hero entities are present', () => {
            // action
            const bans = client.extractBansForMap(historyPayload, heroEntities, 1)
            // assert
            expect(bans).toEqual({
                team1: {heroImage: 'dva-image', heroName: 'DVa'},
                team2: {heroImage: 'ana-image', heroName: 'Ana'},
            })
        })

        it('should return null when the votes for the map have no entities', () => {
            // setup
            const emptyVotes = {payload: {tickets: [{entity_type: 'heroes', entities: []}]}}
            // action / assert
            expect(client.extractBansForMap(emptyVotes, heroEntities, 1)).toBeNull()
        })

        it('should return null when the payload has no tickets', () => {
            // action / assert
            expect(client.extractBansForMap({payload: {}}, heroEntities, 1)).toBeNull()
        })

        it('should return null when the requested map has no votes', () => {
            // action / assert
            expect(client.extractBansForMap(historyPayload, heroEntities, 5)).toBeNull()
        })

        it('should return null when hero display data is missing for a ban', () => {
            // action / assert
            expect(client.extractBansForMap(historyPayload, [], 1)).toBeNull()
        })
    })

    // Note: not the best client setup tests, but should be enough to at least ensure we're doing
    // something with the api key / http timeout configurations
    describe('client setup (api key + timeout)', () => {
        it('should use the provided configFileApiKey as the key for calls if it is passed to the constructor and there is no FACEIT_KEY env variable set', async () => {
            // setup
            delete process.env.FACEIT_KEY

            const faceitClient = new FaceItClient({logger: mockedLogger, configFileApiKey: 'configured-api-key'})
            spyOn(faceitClient as any, 'getJsonUsingNodeHttps').mockRejectedValue({
                status: 418,
                error: new Error('Trigger error to force attempting an authenticated call')
            })
            spyOn(faceitClient as any, 'normalizedAuthenticatedMatchData').mockResolvedValue({} as any)
            const getNormalizedDataMock = spyOn(faceitClient as any, 'getAuthenticatedMatchData').mockResolvedValue({} as any)
            // action
            await faceitClient.getNormalizedMatchData('1234-1234-1234')
            // assert
            expect(getNormalizedDataMock).toHaveBeenCalledWith('1234-1234-1234', 'configured-api-key')

            // teardown
            if (originalFaceItKey !== undefined) {
                process.env.FACEIT_KEY = originalFaceItKey
            }
        })
        it('should use, and prefer, the provided httpTimeoutMs as the reference timeout for calls instead of the default FACEIT_CLIENT_HTTP_TIMEOUT_MS', async () => {
            // setup
            const faceitClient = new FaceItClient({logger: mockedLogger, httpTimeoutMs: 44})
            mockHttpsByUrl([
                {
                    match: 'https://www.faceit.com/api/democracy/v1/match/1234-1234-1235/history',
                    statusCode: 200,
                    body: {}
                },
            ])
            // action / assert
            expect((faceitClient as any).httpTimeoutMs).toBe(44)
        })
    })
})
