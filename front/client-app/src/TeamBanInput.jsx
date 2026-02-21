import ana from './assets/portraits/ana.png'
import anran from './assets/portraits/anran.png'
import ashe from './assets/portraits/ashe.png'
import baptiste from './assets/portraits/baptiste.png'
import bastion from './assets/portraits/bastion.png'
import brigitte from './assets/portraits/brigitte.png'
import cassidy from './assets/portraits/cassidy.png'
import dva from './assets/portraits/d-va.png'
import domina from './assets/portraits/domina.png'
import doomfist from './assets/portraits/doomfist.png'
import echo from './assets/portraits/echo.png'
import emre from './assets/portraits/emre.png'
import freja from './assets/portraits/freja.png'
import genji from './assets/portraits/genji.png'
import hanzo from './assets/portraits/hanzo.png'
import hazard from './assets/portraits/hazard.png'
import illari from './assets/portraits/illari.png'
import jetpackCat from './assets/portraits/jetpack-cat.png'
import junkerQueen from './assets/portraits/junker-queen.png'
import junkrat from './assets/portraits/junkrat.png'
import juno from './assets/portraits/juno.png'
import kiriko from './assets/portraits/kiriko.png'
import lifeweaver from './assets/portraits/lifeweaver.png'
import lucio from './assets/portraits/lucio.png'
import mauga from './assets/portraits/mauga.png'
import mei from './assets/portraits/mei.png'
import mercy from './assets/portraits/mercy.png'
import mizuki from './assets/portraits/mizuki.png'
import moira from './assets/portraits/moira.png'
import orisa from './assets/portraits/orisa.png'
import pharah from './assets/portraits/pharah.png'
import ramatra from './assets/portraits/ramatra.png'
import reaper from './assets/portraits/reaper.png'
import reinhardt from './assets/portraits/reinhardt.png'
import roadhog from './assets/portraits/roadhog.png'
import sigma from './assets/portraits/sigma.png'
import sojourn from './assets/portraits/sojourn.png'
import soldier76 from './assets/portraits/soldier-76.png'
import sombra from './assets/portraits/sombra.png'
import symmetra from './assets/portraits/symmetra.png'
import torbjorn from './assets/portraits/torbjorn.png'
import tracer from './assets/portraits/tracer.png'
import vendetta from './assets/portraits/vendetta.png'
import venture from './assets/portraits/venture.png'
import widowmaker from './assets/portraits/widowmaker.png'
import winston from './assets/portraits/winston.png'
import wreckingBall from './assets/portraits/wrecking-ball.png'
import wuyang from './assets/portraits/wuyang.png'
import zarya from './assets/portraits/zarya.png'
import zenyatta from './assets/portraits/zenyatta.png'
import none from './assets/portraits/ana.png'
import {Select} from "antd";

export const portraits = {
    ana,
    anran,
    ashe,
    baptiste ,
    bastion,
    brigitte ,
    cassidy ,
    dva ,
    domina,
    doomfist ,
    echo ,
    emre,
    freja ,
    genji ,
    hanzo ,
    hazard ,
    illari ,
    jetpackCat,
    junkerQueen ,
    junkrat ,
    juno ,
    kiriko ,
    lifeweaver ,
    lucio,
    mauga ,
    mei,
    mercy,
    mizuki,
    moira ,
    orisa,
    pharah ,
    ramatra ,
    reaper,
    reinhardt,
    roadhog,
    sigma ,
    sojourn ,
    soldier76 ,
    sombra,
    symmetra ,
    torbjorn ,
    tracer ,
    vendetta ,
    venture,
    widowmaker,
    winston ,
    wreckingBall,
    wuyang,
    zarya ,
    zenyatta,
    none
}

const updateBanForTeam = (value, team, handler) => {
    const command = team === 'team1' ? 'team1UpdateBan' : 'team2UpdateBan'
    handler({ command, value})
}

function TeamBanInput(props) {
    const nameOptions = Object.keys(portraits).map(name => ({
        value: name,
        label: name.split('/')[4]
    }))
    let selectedValue
    if(props.selected){
        const selectMatch = (props.selected.match(/\/([a-z0-9\-\_]+)\.png/))
        if(selectMatch){
            selectedValue = selectMatch[1]
        }
    }
    return <div>
       <Select placeholder={'Ban for the current map...'} value={selectedValue} onChange={(value) => updateBanForTeam(value, props.team, props.handler)} options={nameOptions} style={{width: '230px'}}/>
    </div>
}

export default TeamBanInput