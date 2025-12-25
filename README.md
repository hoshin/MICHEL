# M.I.C.H.E.L.
Management Interface for Casting Hosts Enjoying Lightness

## Description and purpose
MICHEL is a personal tool, first and foremost, aimed at helping around someone who'd like to get into casting e-sports matches but feels like there's way too much alt-tabbing going around. It probably won't fit every need, but I'll be glad to accept PRs if it comes to this :)
I'm publishing it under the [CC-BY-NC](https://creativecommons.org/licenses/by-nc/4.0/) license so that anyone finding it useful can pretty much tune it to their liking if they so desire.

The idea is to set the match up beforehand and then pilot everything through a device like a StreamDeck (or anything that can send calls to the main app)

### Features

#### Keep the core data of a match between 2 teams and allow dynamically shared updates as it goes down
Allows to manually input
* Names / logos of the 2 teams playing
* Match format / Round number
* Update scores as you go
* Add a tournament logo
* Utilities 
  * swap the order in which teams will be displayed
  * _(FaceIt only) load room data_ (updates team names & logos)
  * _(FaceIt only) refresh room data_
  
![management-interface.png](documentation/management-interface.png)
Note: yes, it's ugly af, I needed features before tying a bow on that one. We'll get there ... eventually ^^'

#### Query the FaceIt API to retrieve advanced data on a match
MICHEL's integration is currently focused on the Overwatch 2 game integration of FaceIt. It allows to retrieve extra data : 
* Automatically set teams names and logos up using the lobby ID
* Bans for the current map of a match
* Refresh bans if need be (getting bans is a bit finicky atm)

#### Expose ready-to-use templated HTML pages that can be used in AV mixers (like OBS)
The `michel-client-app` part allows to generate calibrated pages that can then be used as an [OBS](https://obsproject.com/) "web source"
![base-template-1.png](documentation/base-template-1.png)

This specific app connects to the websocket exposed by `michel-back` so whatever updates the back receives it'll be sent to the connected "consumers" and update immediately.
![obs-scene-integration.png](documentation/obs-scene-integration.png)

#### Propose a All in one approach through an Electron app
Put simply, the electron app is an executable that bundles both `michel-back` and `michel-client-app`. You can't update anything, but running the app will run all required servers so that
* You have at least a management interface available
* `michel-back` is started
* `michel-client-app` is started too
* the default templates are made accessible to be used as web sources in software like OBS

#### Have a way to update scores, round # and switch sides from a StreamDeck
The provided plugin, once installed will enable you to : 
* Increase/Decrease the score of both teams
* Increase/Decrease the round #
* Swap the positions of the teams (aka: "which one gets displayed on the left VS right")

It's still a bit rough around the edges so it's not published on the marketplace and will need to be installed manually (double-clicking on the plugin should do the trick)

### Getting started
#### I just want the base experience
The bundled app should be right up your alley!
1. Double click it to start it
2. Once the management interface comes up, you should be ready to go
3. To integrate scenes in your AV mixer, add the following (depending on your needs) as a web source :
   * `localhost:5172/game-scene` => The main ingame scene
   * `localhost:5172/score-scene` => A scene only containing the scores of the 2 teams, with logos and names
   * `localhost:5172/casters-scene` => A backdrop for an "out of game" scene (typically to show chat / casters)
   * `localhost:5172/configuration-center` => The configuration page, if the app itself does not work for you or you want a second interface

#### I want to create my own scenes / run all services separately and customize my experience
For the time being, you can still use the bundled app to start the main server. You will need to build your own client application and run it on your own.

In order to be able to connect to that instance of `michel-back` with your own frontend you'll need to refer to its [README.md](back/README.md)

### General architecture
![img.png](documentation/general-architecture.png)

#### Long story short
* If you want to get fancy, the process you absolutely need to run is `michel-back`
* The "All in one" way is through `michelectron`, which'll take care of everything once built
* `michel-client-app` is basically a front-end I built on top of `michel-back`
* `michel-streamdeck-plugin` is just a very simple plugin to pilot `michel-back` from a stream deck

#### Long story longer
I wanted to separate concerns as much as possible. Mostly because not everyone has the same taste as I do when it comes to interfaces for a stream