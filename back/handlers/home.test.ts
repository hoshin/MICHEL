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
            expect(fetchMock).toHaveBeenCalledWith('https://www.faceit.com/api/democracy/v1/match/match-id', {
                "headers": {
                    "Accept": "application/json, text/plain, */*",
                    "Accept-Encoding": "gzip, deflate, br, zstd",
                    "Accept-Language": "en-US,en;q=0.5",
                    "Alt-Used": "www.faceit.com",
                    "Cache-Control": "no-cache",
                    "Connection": "keep-alive",
                    "DNT": "1",
                    "Pragma": "no-cache",
                    "Priority": "u=4",
                    "Referer": "https://www.faceit.com/en/ow2/room/match-id",
                    "Sec-Fetch-Dest": "empty",
                    "Sec-Fetch-Mode": "cors",
                    "Sec-Fetch-Site": "same-origin",
                    "Sec-GPC": "1",
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0",
                    "faceit-referer": "web-next"
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