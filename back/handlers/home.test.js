import { fn, spyOn } from 'jest-mock'
import { updatedLobbyDataFromFaceItMatchId } from './home.js'
describe('updatedLobbyDataFromFaceItMatchId', () => {
    it('should not try and fetch anything if no matchId is provided', async () => {
        // setup
        const nextMock = fn()
        // action
        await updatedLobbyDataFromFaceItMatchId(undefined, 1, nextMock)
        // assert
        expect(nextMock).not.toHaveBeenCalled()
    })
    it('should log an error and return if matchId is provided but fetch fails', async () => {
        // setup
        const nextMock = fn()
        const fetchMock = spyOn(global, 'fetch').mockResolvedValue(
            {
                status: 418
            }
        )
        const errorSpy = spyOn(console, 'error').mockImplementation(() => {})
        // action
        await updatedLobbyDataFromFaceItMatchId('match-id', 1, nextMock)
        // assert
        expect(fetchMock).toHaveBeenCalledWith('https://www.faceit.com/api/democracy/v1/match/match-id',  {"headers": {"Accept": "application/json, text/plain, */*", "Accept-Encoding": "gzip, deflate, br, zstd", "Accept-Language": "en-US,en;q=0.5", "Alt-Used": "www.faceit.com", "Cache-Control": "no-cache", "Connection": "keep-alive", "DNT": "1", "Pragma": "no-cache", "Priority": "u=4", "Referer": "https://www.faceit.com/en/ow2/room/match-id", "Sec-Fetch-Dest": "empty", "Sec-Fetch-Mode": "cors", "Sec-Fetch-Site": "same-origin", "Sec-GPC": "1", "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:142.0) Gecko/20100101 Firefox/142.0", "faceit-referer": "web-next"}, "method": "GET"})
        expect(errorSpy).toHaveBeenCalledWith('Could not update lobby data using FaceIt match id match-id', new Error('Response status not 200 : 418'))
        expect(nextMock).toHaveBeenCalled()
    })
})