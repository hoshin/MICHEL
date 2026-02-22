# Before initial release

1. Understand why the front creates multiple connections to the backend (should not, at least not that many)
   * [X] Do a first pass of websocket config/setup cleanup
   * [X] Leverage `useEffect` and avoid leaving open connections when a component unmounts
2. ensure we have a build step that
   * neatly packages everything
   * correctly names each packaged item according to its current target version
   * to pass : a non-tech should be able to go through the main readme and be up and running
4. READMES are up to date
   * Update general architecture
   * Create a HOWTO build
   * Most important : basic HOWTO use
5. Ensure that however we quit, the electron app does not leave orphan processes behind it (either when closing the window, alt+f4, or selecting the "Quit" option)
6. [Nice to have] Front-end has a favicon
7. [Nice to have] general :broom:
   * [X] "New connection from undefined"
   * electron app : no 5s wait => spinner until all servers are spun up
8. [X] Integrate new heroes in bans

# After initial release

1. allow the electron app to stop/restart back/front/both servers
2. allow the electron app to detect a config file / to accept a config file as an input
3. have menus to open the various available scenes
4. allow to set custom ports for back and front
5. ViteJS?
6. mini-db to store data (sq-lite) ?