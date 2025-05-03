import { action, KeyDownEvent, SingletonAction, WillAppearEvent } from "@elgato/streamdeck";

/**
 * An example action class that displays a count that increments by one each time the button is pressed.
 */
@action({ UUID: "com.hoshin-casts.michel-deck.map-counter" })
export class MapCounter extends SingletonAction<CounterSettings> {
	/**
	 * The {@link SingletonAction.onWillAppear} event is useful for setting the visual representation of an action when it becomes visible. This could be due to the Stream Deck first
	 * starting up, or the user navigating between pages / folders etc.. There is also an inverse of this event in the form of {@link streamDeck.client.onWillDisappear}. In this example,
	 * we're setting the title to the "count" that is incremented in {@link MapCounter.onKeyDown}.
	 */
	override onWillAppear(ev: WillAppearEvent<CounterSettings>): void | Promise<void> {
		return ev.action.setTitle('-');
	}

	/**
	 * Listens for the {@link SingletonAction.onKeyDown} event which is emitted by Stream Deck when an action is pressed. Stream Deck provides various events for tracking interaction
	 * with devices including key down/up, dial rotations, and device connectivity, etc. When triggered, {@link ev} object contains information about the event including any payloads
	 * and action information where applicable. In this example, our action will display a counter that increments by one each press. We track the current count on the action's persisted
	 * settings using `setSettings` and `getSettings`.
	 */
	override async onKeyDown(ev: KeyDownEvent<CounterSettings>): Promise<void> {
		// Update the count from the settings.
		const { settings } = ev.payload;
		// settings.incrementBy ??= 1;
		// settings.count = (settings.count ?? 0) + settings.incrementBy;

		const action = settings.direction === '+' ? 'increase-map-count' : 'decrease-map-count';

		try{
			await fetch(`http://localhost:3000/${action}`, {
				method: 'POST',
				headers: {
					'Accept': 'application/json',
				},
				body: JSON.stringify({})
			})
			// await ev.action.setSettings(settings);
			// await ev.action.setTitle('+');
		} catch (err) {

		}
	}
}

/**
 * Settings for {@link MapCounter}.
 */
type CounterSettings = {
	direction?: '+' | '-';
};
