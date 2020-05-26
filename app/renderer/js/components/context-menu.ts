import {remote} from 'electron';
import WebView from './webview';
import handleExternalLink from './handle-external-link';
import * as t from '../utils/translation-util';
const {clipboard, Menu, MenuItem} = remote;

export const contextMenu = (webview: WebView, event: any) => {
	const webContents = webview.$el.getWebContents();
	const props = event.params;
	const isText = Boolean(props.selectionText.length);
	const isLink = Boolean(props.linkURL);

	const getContextMenu = (): Electron.MenuItemConstructorOptions[] => {
		return [{
			label: t.__('Add to Dictionary'),
			visible: props.isEditable && isText && props.misspelledWord,
			click(_item) {
				webContents.session.addWordToSpellCheckerDictionary(props.misspelledWord);
			}
		}, {
			type: 'separator'
		}, {
			label: t.__(`Look Up "${(props.selectionText as string)}"`),
			visible: process.platform === 'darwin' && isText,
			click(_item) {
				webContents.showDefinitionForSelection();
			}
		}, {
			type: 'separator'
		}, {
			label: t.__('Cut'),
			visible: isText,
			enabled: props.isEditable,
			accelerator: 'CommandOrControl+X',
			click(_item){
				webContents.cut();
			}
		}, {
			label: t.__('Copy'),
			accelerator: 'CommandOrControl+C',
			click(_item){
				webContents.copy();
			}
		}, {
			label: t.__('Paste'), // Bug: Paste replaces text
			accelerator: 'CommandOrControl+V',
			enabled: props.isEditable,
			click(){
				webContents.paste();
			}
		}, {
			type: 'separator'
		}, {
			label: t.__('Copy Link'),
			visible: isText && isLink,
			click(_item) {
				clipboard.write({
					bookmark: props.linkText,
					text: props.linkURL
				});
			}
		}, {
			label: t.__('Open Link'), // Not working as of now
			visible: isText && isLink,
			click(_item) {
				handleExternalLink.call(webview, event);
			}
		}, {
			label: t.__('Copy Image'),
			visible: props.mediaType === 'image',
			click(_item) {
				webContents.copyImageAt(props.x, props.y);
			}
		}, {
			label: t.__('Copy Image URL'),
			visible: props.mediaType === 'image',
			click(_item) {
				clipboard.write({
					bookmark: props.srcURL,
					text: props.srcURL
				});
			}
		}];
	};

	const makeSuggestion = (suggestion: string) => {
		return new MenuItem({
			label: suggestion,
			async click() {
				await webContents.insertText(suggestion);
			}
		});
	};

	const ctx = getContextMenu();
	const menu = Menu.buildFromTemplate(ctx);

	if (props.misspelledWord) {
		if (props.dictionarySuggestions.length > 0) {
			Object.values(props.dictionarySuggestions).forEach(value => {
				menu.insert(0, makeSuggestion(value as string));
			});
		} else {
			menu.insert(0, new MenuItem({
				label: 'No Suggestion Found',
				enabled: false
			}));
		}
	}
	console.log(props.dictionarySuggestions);
	menu.popup();
};
