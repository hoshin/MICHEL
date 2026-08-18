import * as https from 'https'
import type {Logger} from 'pino'

export type FaceItFaction = any

export type FaceItMatchData = {
    raw: any,
    team1: FaceItFaction,
    team2: FaceItFaction,
}

type BanDisplayData = {
    heroImage: string,
    heroName: string,
}

export type FaceItBans = {
    team1: BanDisplayData,
    team2: BanDisplayData,
} | null

const FACEIT_PUBLIC_MODE_BROWSER_USER_AGENT = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0 Safari/537.36'

// Browser User-Agent is mandatory on public FaceIt match endpoint (which 403s without it)
// and harmless elsewhere; keeping it in all headers for consistency, and in case FaceIt's
// policy starts requiring it for other endpoints
const FACEIT_PUBLIC_MODE_BASE_HTTP_HEADERS: Record<string, string> = {
    'Accept': 'application/json',
    'User-Agent': FACEIT_PUBLIC_MODE_BROWSER_USER_AGENT,
}

// Unknown when FaceIt might decide to terminate a hanging connexion,
// so we ensure we purposefully do it after this timeout on our end
const FACEIT_CLIENT_HTTP_TIMEOUT_MS = 15000

type FaceItClientDependencies = {
    logger: Logger,
    // Config-file API key. The runtime FACEIT_KEY env var (read in
    // effectiveApiKey) always supersedes it.
    configFileApiKey?: string,
    httpTimeoutMs?: number,
}

/**
 * Stateless gateway to FaceIt. Owns every network call and payload
 * normalization so that the rest of the application never has to know about
 * FaceIt's endpoints, auth scheme or response shapes. Holds no seriesData and
 * performs no broadcasting: it takes inputs and returns domain-shaped data.
 */
export class FaceItClient {
    private readonly logger: Logger
    private readonly configFileApiKey: string | undefined
    private readonly httpTimeoutMs: number

    constructor({logger, configFileApiKey, httpTimeoutMs}: FaceItClientDependencies) {
        this.logger = logger
        this.configFileApiKey = configFileApiKey
        this.httpTimeoutMs = httpTimeoutMs ?? FACEIT_CLIENT_HTTP_TIMEOUT_MS
    }

    static extractMatchId = (matchIdOrURL: string): string => {
        const withoutQueryOrHash = matchIdOrURL.split(/[?#]/)[0]
        const segments = withoutQueryOrHash.split('/').filter(segment => segment.length > 0)
        return segments.find(segment => /^\d+-[0-9a-f-]+$/i.test(segment)) ?? segments.pop() ?? ''
    }

    /**
     * Every FaceIt call goes through this single Node https.get client.
     * The www.faceit.com match endpoint looks gated by a WAF that inspects BOTH the User-Agent
     * (403 without the browser UA) AND the TLS/connection fingerprint. Empirically, Node's
     * https stack clears that fingerprint check while fetch/undici does not,
     * so the whole-application choice of https.get over fetch is load-bearing.
     * Consolidating all FaceIt calls (API or public mode) through a single client
     * should hopefully prevent other similar issues... and will make things easier to maintain
     */
    private getJsonUsingNodeHttps = (url: string, extraHeaders: Record<string, string> = {}): Promise<any> => new Promise((resolve, reject) => {
        const request = https.get(url, {
            headers: {
                ...FACEIT_PUBLIC_MODE_BASE_HTTP_HEADERS,
                ...extraHeaders,
            },
        }, response => {
            let responseBody = ''

            response.on('data', chunk => {
                responseBody += chunk
            })

            response.on('end', () => {
                if (response.statusCode !== 200) {
                    reject(new Error(`Response status not 200 : ${response.statusCode}`))
                    return
                }

                try {
                    resolve(JSON.parse(responseBody))
                } catch (error) {
                    reject(error)
                }
            })
        })

        // In case FaceIt times out late / never
        // Arm an idle timeout and destroy the request when it
        // fires; destroy(err) re-emits 'error', which the handler below turns
        // into the single rejection path.
        request.setTimeout(this.httpTimeoutMs)
        request.on('timeout', () => {
            request.destroy(new Error(`FaceIt request timed out after ${this.httpTimeoutMs} ms`))
        })

        request.on('error', reject)
    })

    // Runtime env var wins so operators can override without editing the
    // config file; environment variable always supersedes configuration
    private effectiveApiKey = (): string | undefined =>
        process.env.FACEIT_KEY || this.configFileApiKey

    private getAuthenticatedMatchData = async (matchId: string, key: string | undefined): Promise<any> => {
        if (!key) {
            throw new Error('No FaceIt API key available for authenticated fallback')
        }

        return this.getJsonUsingNodeHttps(`https://open.faceit.com/data/v4/matches/${matchId}`, {
            'Authorization': `Bearer ${key}`,
        })
    }

    private requireBothFactions = (teams: any, source: string): { faction1: any, faction2: any } => {
        const faction1 = teams?.faction1
        const faction2 = teams?.faction2
        if (!faction1 || !faction2) {
            throw new Error(`${source} FaceIt match data does not contain both teams`)
        }
        return {faction1, faction2}
    }

    private normalizedPublicMatchData = (jsonData: any): FaceItMatchData => {
        const matchData = jsonData?.payload
        const {faction1, faction2} = this.requireBothFactions(matchData?.teams, 'Public')

        const heroEntities = matchData?.matchCustom?.tree?.heroes?.values?.value ?? []
        return {
            raw: {
                ...matchData,
                voting: {
                    ...matchData.voting,
                    heroes: {
                        ...matchData.voting?.heroes,
                        entities: heroEntities,
                    },
                },
            },
            team1: faction1,
            team2: faction2,
        }
    }

    private normalizedAuthenticatedMatchData = (jsonData: any): FaceItMatchData => {
        const {faction1, faction2} = this.requireBothFactions(jsonData?.teams, 'Authenticated')
        return {
            raw: jsonData,
            team1: faction1,
            team2: faction2,
        }
    }

    getNormalizedMatchData = async (matchId: string): Promise<FaceItMatchData> => {
        try {
            const publicJsonData = await this.getJsonUsingNodeHttps(`https://www.faceit.com/api/match/v2/match/${matchId}`)
            return this.normalizedPublicMatchData(publicJsonData)
        } catch (publicError) {
            this.logger.warn({msg: 'Public FaceIt match data query failed. Attempting authenticated API call.', error: publicError.message})
            const authenticatedJsonData = await this.getAuthenticatedMatchData(matchId, this.effectiveApiKey())
            return this.normalizedAuthenticatedMatchData(authenticatedJsonData)
        }
    }

    getLobbyHistory = async (matchId: string): Promise<any> =>
        this.getJsonUsingNodeHttps(`https://www.faceit.com/api/democracy/v1/match/${matchId}/history`)

    // mapNumber => [1, +Infinity[
    private heroVotesForMap = (historyPayload: any, mapNumber: number): any[] | undefined => {
        const heroVotingPerMap = historyPayload?.payload?.tickets?.filter(ticket => ticket.entity_type === 'heroes')
        return heroVotingPerMap?.[mapNumber - 1]?.entities
    }

    /**
     * Whether the given history payload carries any hero-ban votes for the map.
     * Lets a caller decide if it's worth loading the hero display data before
     * calling extractBansForMap.
     */
    hasBanVotesForMap = (historyPayload: any, mapNumber: number): boolean => {
        const votes = this.heroVotesForMap(historyPayload, mapNumber)
        return !!votes && votes.length > 0
    }

    /**
     * Pure transform: given a democracy history payload, the hero display
     * entities (guid -> image/name lookup, sourced from getNormalizedMatchData),
     * and a 1-based map number, return the per-team ban display data or null
     * when the inputs are insufficient (no votes for that map, no dropped
     * heroes, or missing display data for a ban).
     */
    extractBansForMap = (historyPayload: any, heroEntities: any[], mapNumber: number): FaceItBans => {
        const votesForMap = this.heroVotesForMap(historyPayload, mapNumber)
        const votesForMapHasEntities = votesForMap && votesForMap.length > 0
        if (!votesForMapHasEntities) {
            return null
        }

        const bannedHeroes = votesForMap
            .filter((voteEntity) => voteEntity.status === 'drop')
            .map((bannedPick) => ({
                guid: bannedPick.guid,
                selected_by: bannedPick.selected_by,
                round: bannedPick.round,
            }))

        const team1Ban = bannedHeroes.filter(ban => ban.selected_by === 'faction1')[0]
        const team2Ban = bannedHeroes.filter(ban => ban.selected_by === 'faction2')[0]
        if (!team1Ban || !team2Ban) {
            return null
        }

        const heroDataForTeam1Ban = (heroEntities ?? []).filter(entity => team1Ban.guid === entity.guid)[0]
        const heroDataForTeam2Ban = (heroEntities ?? []).filter(entity => team2Ban.guid === entity.guid)[0]
        if (!heroDataForTeam1Ban || !heroDataForTeam2Ban) {
            return null
        }

        return {
            team1: {heroImage: heroDataForTeam1Ban.image_lg, heroName: heroDataForTeam1Ban.name},
            team2: {heroImage: heroDataForTeam2Ban.image_lg, heroName: heroDataForTeam2Ban.name},
        }
    }
}
