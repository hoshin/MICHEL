import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { IncrementCounter } from "./actions/increment-counter";
import { MapCounter } from "./actions/map-counter";
import {Toggle} from "./actions/toggle";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register the increment action.
streamDeck.actions.registerAction(new IncrementCounter());

// Register the increment action.
streamDeck.actions.registerAction(new MapCounter());

// Register the increment action.
streamDeck.actions.registerAction(new Toggle());

// Finally, connect to the Stream Deck.
streamDeck.connect();
