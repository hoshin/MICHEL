export const DEFAULT_STATE = {
    team1: {
        name: '',
        score: 0,
        logo: ''
    },
    team2: {
        name: '',
        score: 0,
        logo: ''
    },
    display: {
        right: 'team1',
        left: 'team2',
        mapCount: 0,
        mapFormat: 'FT3',
        tournamentLogo: '',
        optionalLogoDisplay: true
    },
    faceIt: {
        matchId: ''
    }
}

export const DEFAULT_LOGO = 'https://assets.olympe.xyz/assets/organizations/2/profile'

export const WEBSOCKET_URL = 'ws://localhost:3000'