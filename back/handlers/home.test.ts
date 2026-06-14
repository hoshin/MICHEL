import {fn, spyOn} from 'jest-mock'
import {describe, expect, it} from '@jest/globals'
import {DEFAULT_SERIES_DATA, MichelBackService} from "./home";
import {Response as ExpressResponse} from 'express'

describe('MichelBackService', () => {
    let michelBackService: MichelBackService

    describe('updatedLobbyDataFromFaceItMatchId', () => {
        beforeEach(() => {
            const connectionPool = []
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
        it('should log an error and return if matchId is provided but fetch fails', async () => {
            // setup
            const nextMock = fn()

            const mockedFetchResponse = {
                status: 418
            } as unknown as Response
            const fetchMock = spyOn(global, 'fetch').mockResolvedValue(
                mockedFetchResponse
            )
            const errorSpy = spyOn(console, 'error').mockImplementation(() => {
            })
            // action
            await michelBackService.updatedLobbyDataFromFaceItMatchId('match-id', 1, nextMock)
            // assert
            expect(fetchMock).toHaveBeenCalledWith('https://www.faceit.com/api/democracy/v1/match/match-id/history', {
                "headers": {
                    "Accept": "application/json",
                }, "method": "GET"
            })
            expect(errorSpy).toHaveBeenCalledWith('Could not update lobby data using FaceIt match id match-id', new Error('Response status not 200 : 418'))
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
                json: jest.fn()
            } as unknown as ExpressResponse
            // action
            michelBackService.sendUpdatedStateToCaller(res)
            // assert
            expect(res.json).toHaveBeenCalledWith(
                {
                    "display": {
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
            const sendStub = jest.fn()
            const connectionPool = [
                {send: sendStub},
                {send: sendStub}
            ]
            const michelBackService = new MichelBackService(connectionPool, false)
            const expectedResponse = JSON.stringify({
                "display": {
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
            const res: ExpressResponse = { json: jest.fn() } as unknown as ExpressResponse

            // action
            michelBackService.swapTeams(res)

            // assert
            expect(sendUpdatedStateStub).toHaveBeenCalledWith(res)
        })

        it('should broadcast the updated state to all WebSocket clients after swapping', () => {
            // setup
            const sendStub = jest.fn()
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

        it('should apply team names and scores when the back is at defaults', () => {
            const svc = new MichelBackService([], false)
            svc.catchup(null, {
                team1: { name: 'Alpha', score: 2 },
                team2: { name: 'Bravo', score: 1 },
            })
            expect(svc.getSeriesData().team1).toMatchObject({ name: 'Alpha', score: 2 })
            expect(svc.getSeriesData().team2).toMatchObject({ name: 'Bravo', score: 1 })
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