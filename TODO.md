# Before initial release

1. Understand why the front creates multiple connections to the backend (should not, at least not that many)
2. ensure we have a build step that
   * neatly packages everything
   * every generated items either has the correct version per, or is packaged in an archive that has the correct version
   * to pass : a non-tech should be able to go through the main readme and be up and running
4. READMES are up to date
5. Ensure that however we quit, the electron app does not leave orphan processes behind it (either when closing the window, alt+f4, or selecting the "Quit" option)
6. Front-end has a favicon
7. general :broom:
   * "New connection from undefined"
   * electron app : no 5s wait => spinner until all servers are spun up
8. [X] Integrate new heroes in bans

# After initial release

1. allow the electron app to stop/restart back/front/both servers
2. allow the electron app to detect a config file / to accept a config file as an input
3. have menus to open the various available scenes
4. allow to set custom ports for back and front
5. ViteJS?