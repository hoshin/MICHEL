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
    standings: {
    },
    faceIt: {
        matchId: ''
    }
}

export const DEFAULT_LOGO = 'https://media.discordapp.net/attachments/1231353263161344090/1400231498912890920/FCE_LG_S6_Logo_V_Black.png?ex=68b4c134&is=68b36fb4&hm=5ba9947e28a43cdefec05808c9b1b4b7ede6aa58c9e89cd1182879b6362c2856&=&format=webp&quality=lossless&width=754&height=856'

export const WEBSOCKET_URL = 'ws://localhost:3000'