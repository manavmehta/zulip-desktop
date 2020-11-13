import {ipcMain, BrowserView} from 'electron';

import * as ConfigUtil from '../renderer/js/utils/config-util';

import {View, ViewProps} from './view';

import {mainWindow} from '.';

class ViewManager {
	views: Record<number, View>;
	selectedIndex: number;
	domains: Record<string, string>;

	constructor() {
		this.views = {};
		this.selectedIndex = -1;
		this.registerIpcs();
	}

	registerIpcs(): void {
		ipcMain.on('create-view', async (_event: Event, props: ViewProps) => {
			await this.create(props);
		});

		ipcMain.on('select-view', async (_event: Event, index: number) => {
			await this.select(index);
		});

		ipcMain.on('destroy-view', (_event: Event, index: number) => {
			this.destroy(index);
		});

		ipcMain.on('destroy-all-views', () => {
			this.destroyAll();
		});

		ipcMain.on('show-notification-settings', async (_event: Event, index: number) => {
			await this.showNotificationSettings(index);
		});

		ipcMain.on('switch-url', async (_event: Event, index: number, url: string) => {
			await this.switchUrl(index, url);
		});

		// Sends a message to the selected View's webContents.
		ipcMain.on('forward-view-message', (_event: Event, name: string, ...parameters: any[]) => {
			this.views[this.selectedIndex].webContents.send(name, ...parameters);
		});

		ipcMain.on('forward-message-all', (_event: Event, name: string, ...parameters: any[]) => {
			this.forwardMessageAll(name, ...parameters);
		});

		ipcMain.on('call-view-function', (_event: Event, name: string, ...parameters: any[]) => {
			this.callViewFunction(this.selectedIndex, name, ...parameters);
		});

		ipcMain.on('call-specific-view-function', (_event: Event, index: number, name: string, ...parameters: any[]) => {
			this.callViewFunction(index, name, ...parameters);
		});

		ipcMain.on('toggle-silent', (_event: Event, state: boolean) => {
			for (const id in this.views) {
				if (id) {
					const view = this.views[id];
					try {
						view.webContents.setAudioMuted(state);
					} catch (error: unknown) {
						// View is not ready yet
						view.webContents.addListener('dom-ready', () => {
							view.webContents.setAudioMuted(state);
						});
						console.log(error);
					}
				}
			}
		});

		ipcMain.on('focus-view-with-contents', (_event: Event, contents: Electron.webContents) => {
			const view = BrowserView.fromWebContents(contents);
			if (view.webContents) {
				view.webContents.focus();
			}
		});
	}

	async showNotificationSettings(index: number): Promise<void> {
		await this.views[index].showNotificationSettings();
	}

	async switchUrl(index: number, url: string): Promise<void> {
		const view = this.views[index];
		await view.webContents.loadURL(url);
	}

	// Creates a new View and appends it to this.views.
	async create(props: ViewProps): Promise<void> {
		if (this.views[props.index]) {
			return;
		}

		const view = new View(props);
		this.views[props.index] = view;
		await view.webContents.loadURL(props.url);
	}

	async select(index: number): Promise<void> {
		const view = this.views[index];
		if (!view || view.isDestroyed()) {
			console.log('Attempt to select a view that does not exist.');
			return;
		}

		this.selectedIndex = index;
		mainWindow.setBrowserView(view);
		this.fixBounds(mainWindow);
		if (!view.webContents.getURL()) {
			const {url} = view;
			await view.webContents.loadURL(url);
		}
	}

	fixBounds(mainWindow: Electron.BrowserWindow): void {
		// Any updates to the sidebar width should reflect both here and in css
		const SIDEBAR_WIDTH = 54;
		const view = this.views[this.selectedIndex];
		const showSidebar = ConfigUtil.getConfigItem('showSidebar', true);
		if (!view) {
			return;
		}

		const {width, height} = mainWindow.getContentBounds();

		view.setBounds({
			x: showSidebar ? SIDEBAR_WIDTH : 0,
			y: 0,
			width: showSidebar ? width - SIDEBAR_WIDTH : width,
			height
		});
		view.setAutoResize({width: true, height: true});
	}

	destroy(index: number): void {
		const view = this.views[index];
		if (!view || view.isDestroyed()) {
			console.log('Attempt to delete a view that does not exist.');
			return;
		}

		if (mainWindow.getBrowserView() === view) {
			mainWindow.setBrowserView(null);
		}

		view.destroy();
		delete this.views[index];
	}

	destroyAll(): void {
		mainWindow.setBrowserView(null);
		for (const id in this.views) {
			if (id) {
				this.destroy(this.views[id].index);
			}
		}
	}

	callViewFunction(index: number, name: string, ...parameters: any[]): void {
		const view = this.views[index];
		if (!view || view.isDestroyed()) {
			return;
		}

		(view as any)[name as keyof View](...parameters);
	}

	forwardMessageAll(name: string, ...args: any[]): void {
		for (const id in this.views) {
			if (id) {
				this.views[id].webContents.send(name, ...args);
			}
		}
	}
}

export = new ViewManager();
