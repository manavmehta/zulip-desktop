import { ipcRenderer } from 'electron';

import { EventEmitter } from 'events';

import { NotificationData, newNotification } from './notification';

type ListenerType = ((...args: any[]) => void);

class ElectronBridge extends EventEmitter {
	send_notification_reply_message_supported: boolean;
	idle_on_system: boolean;
	last_active_on_system: number;

	constructor() {
		super();
		this.send_notification_reply_message_supported = false;
		// Indicates if the user is idle or not
		this.idle_on_system = false;

		// Indicates the time at which user was last active
		this.last_active_on_system = Date.now();
	}

	send_event = (eventName: string | symbol, ...args: any[]): void => {
		this.emit(eventName, ...args);
	};

	on_event = (eventName: string, listener: ListenerType): void => {
		this.on(eventName, listener);
	};

	new_notification = (
		title: string,
		options: NotificationOptions | undefined,
		dispatch: (type: string, eventInit: EventInit) => boolean
	): NotificationData =>
		newNotification(title, options, dispatch);

	get_idle_on_system = (): boolean => this.idle_on_system;

	get_last_active_on_system = (): number => this.last_active_on_system;

	get_send_notification_reply_message_supported = (): boolean =>
		this.send_notification_reply_message_supported;

	set_send_notification_reply_message_supported = (value: boolean): void => {
		this.send_notification_reply_message_supported = value;
	};
}

const electron_bridge = new ElectronBridge();

electron_bridge.on('total_unread_count', (...args) => {
	ipcRenderer.send('unread-count', ...args);
});

electron_bridge.on('realm_name', realmName => {
	const serverURL = location.origin;
	ipcRenderer.send('realm-name-changed', serverURL, realmName);
});

electron_bridge.on('realm_icon_url', iconURL => {
	const serverURL = location.origin;
	iconURL = iconURL.includes('http') ? iconURL : `${serverURL}${iconURL}`;
	ipcRenderer.send('realm-icon-changed', serverURL, iconURL);
});

electron_bridge.on('unread_pm_count', unreadPMs => {
	const unreadPMCount = unreadPMs.unread_pm_count;
	const realmUri = unreadPMs.realm_uri;
	ipcRenderer.send('forward-message', 'unread-pm-count', unreadPMCount, realmUri);
});

// this follows node's idiomatic implementation of event
// emitters to make event handling more simpler instead of using
// functions zulip side will emit event using ElectronBrigde.send_event
// which is alias of .emit and on this side we can handle the data by adding
// a listener for the event.
export default electron_bridge;
