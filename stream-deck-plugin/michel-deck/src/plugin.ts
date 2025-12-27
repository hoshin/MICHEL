import streamDeck, { LogLevel } from "@elgato/streamdeck";

import { IncrementCounter } from "./actions/increment-counter";
import { IncrementCustomCounter} from "./actions/increment-custom-counter";
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

// Register the increment custom counter action.
streamDeck.actions.registerAction(new IncrementCustomCounter());

// Finally, connect to the Stream Deck.
streamDeck.connect();
