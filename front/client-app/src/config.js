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

export const DEFAULT_LOGO = 'https://media.discordapp.net/attachments/1231353263161344090/1400231498912890920/FCE_LG_S6_Logo_V_Black.png?ex=68b36fb4&is=68b21e34&hm=a569b00027bdfa35ce298f219832d379c7f6ca6619767414e9450fba8a8c6686&=&format=webp&quality=lossless&width=754&height=856'

export const WEBSOCKET_URL = 'ws://localhost:3000'