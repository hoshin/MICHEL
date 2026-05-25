import { WEBSOCKET_URL } from "./config.js";

export class WSManager {
  private socket: WebSocket;
  private setTeamsData: (jsonData: any) => void;
  constructor() {
    this.socket = new WebSocket(WEBSOCKET_URL);
    this.socket.addEventListener("message", (event) => {
      this.setTeamsDataCb(JSON.parse(event.data));
    });
    this.socket.addEventListener("open", (event) => {
      this.socket.send(JSON.stringify({ init: 1 }));
    });
  }
  setTeamsDataCb(setTeamsDataCb: (jsonData: any) => void) {
    this.setTeamsData = setTeamsDataCb;
  }
  sendCommandHandler = (command) => (event) => {
    event.preventDefault();
    this.socket.send(JSON.stringify({ command, value: event.target.value }));
  };
}
