import { JsonDB } from 'node-json-db';

import escape from 'escape-html';
import request from 'request';
import fs from 'fs';
import path from 'path';
import Logger from './logger-util';
import { ipcRenderer, remote } from 'electron';

import * as RequestUtil from './request-util';
import * as EnterpriseUtil from './enterprise-util';
import * as Messages from '../../../resources/messages';

const { app, dialog } = remote;

interface ServerConf {
	url: string;
	alias?: string;
	icon?: string;
	ignoreCerts?: boolean;
}

const logger = new Logger({
	file: 'domain-util.log',
	timestamp: true
});

const defaultIconUrl = '../renderer/img/icon.png';

export let db: JsonDB;

reloadDB();
// Migrate from old schema
if (db.getData('/').domain) {
	addDomain({
		alias: 'Zulip',
		url: db.getData('/domain')
	});
	db.delete('/domain');
}

export function getDomains(): ServerConf[] {
	reloadDB();
	if (db.getData('/').domains === undefined) {
		return [];
	} else {
		return db.getData('/domains');
	}
}

export function getDomain(index: number): ServerConf {
	reloadDB();
	return db.getData(`/domains[${index}]`);
}

export function shouldIgnoreCerts(url: string): boolean {
	const domains = getDomains();
	for (const domain of domains) {
		if (domain.url === url) {
			return domain.ignoreCerts;
		}
	}
	return null;
}

export function getIndex(url: string): number {
	const domains = getDomains();
	let index = 0;
	for (const domain of domains) {
		index++;
		if (domain.url === url) {
			return (index - 1);
		}
	}
	// invalid index, use check in calling function
	return -1;
}

function updateDomain(index: number, server: ServerConf): void {
	reloadDB();
	db.push(`/domains[${index}]`, server, true);
}

export async function addDomain(server: ServerConf): Promise<void> {
	const { ignoreCerts } = server;
	if (server.icon) {
		const localIconUrl = await saveServerIcon(server, ignoreCerts);
		server.icon = localIconUrl;
		db.push('/domains[]', server, true);
		reloadDB();
	} else {
		server.icon = defaultIconUrl;
		db.push('/domains[]', server, true);
		reloadDB();
	}
}

export function removeDomains(): void {
	db.delete('/domains');
	reloadDB();
}

export function removeDomain(index: number): boolean {
	if (EnterpriseUtil.isPresetOrg(getDomain(index).url)) {
		return false;
	}
	db.delete(`/domains[${index}]`);
	reloadDB();
	return true;
}

// Check if domain is already added
export function duplicateDomain(domain: string): boolean {
	domain = formatUrl(domain);
	return getDomains().some(server => server.url === domain);
}

async function checkCertError(domain: string, serverConf: ServerConf, error: string, silent: boolean): Promise<ServerConf> {
	if (silent) {
		// since getting server settings has already failed
		return serverConf;
	} else {
		// Report error to sentry to get idea of possible certificate errors
		// users get when adding the servers
		logger.reportSentry(new Error(error).toString());
		const certErrorMessage = Messages.certErrorMessage(domain, error);
		const certErrorDetail = Messages.certErrorDetail();

		const { response } = await dialog.showMessageBox({
			type: 'warning',
			buttons: ['Yes', 'No'],
			defaultId: 1,
			message: certErrorMessage,
			detail: certErrorDetail
		});
		if (response === 0) {
			// set ignoreCerts parameter to true in case user responds with yes
			serverConf.ignoreCerts = true;
			try {
				return await getServerSettings(domain, serverConf.ignoreCerts);
			} catch (_) {
				if (error === Messages.noOrgsError(domain)) {
					throw new Error(error);
				}
				return serverConf;
			}
		} else {
			throw new Error('Untrusted certificate.');
		}
	}
}

// ignoreCerts parameter helps in fetching server icon and
// other server details when user chooses to ignore certificate warnings
export async function checkDomain(domain: string, ignoreCerts = false, silent = false): Promise<ServerConf> {
	if (!silent && duplicateDomain(domain)) {
		// Do not check duplicate in silent mode
		throw new Error('This server has been added.');
	}

	domain = formatUrl(domain);

	const serverConf = {
		icon: defaultIconUrl,
		url: domain,
		alias: domain,
		ignoreCerts
	};

	try {
		return await getServerSettings(domain, serverConf.ignoreCerts);
	} catch (err) {
		// Make sure that error is an error or string not undefined
		// so validation does not throw error.
		const error = err || '';

		const certsError = error.toString().includes('certificate');
		if (certsError) {
			const result = await checkCertError(domain, serverConf, error, silent);
			return result;
		} else {
			throw new Error(Messages.invalidZulipServerError(domain));
		}
	}
}

async function getServerSettings(domain: string, ignoreCerts = false): Promise<ServerConf> {
	const serverSettingsOptions = {
		url: domain + '/api/v1/server_settings',
		...RequestUtil.requestOptions(domain, ignoreCerts)
	};

	return new Promise((resolve, reject) => {
		request(serverSettingsOptions, (error: string, response: any) => {
			if (!error && response.statusCode === 200) {
				const data = JSON.parse(response.body);
				if (Object.prototype.hasOwnProperty.call(data, 'realm_icon') && data.realm_icon) {
					resolve({
						// Some Zulip Servers use absolute URL for server icon whereas others use relative URL
						// Following check handles both the cases
						icon: data.realm_icon.startsWith('/') ? data.realm_uri + data.realm_icon : data.realm_icon,
						url: data.realm_uri,
						alias: escape(data.realm_name),
						ignoreCerts
					});
				} else {
					reject(Messages.noOrgsError(domain));
				}
			} else {
				reject(response);
			}
		});
	});
}

export async function saveServerIcon(server: ServerConf, ignoreCerts = false): Promise<string> {
	const url = server.icon;
	const domain = server.url;

	const serverIconOptions = {
		url,
		...RequestUtil.requestOptions(domain, ignoreCerts)
	};

	// The save will always succeed. If url is invalid, downgrade to default icon.
	return new Promise(resolve => {
		const filePath = generateFilePath(url);
		const file = fs.createWriteStream(filePath);
		try {
			request(serverIconOptions).on('response', (response: any) => {
				response.on('error', (err: string) => {
					logger.log('Could not get server icon.');
					logger.log(err);
					logger.reportSentry(err);
					resolve(defaultIconUrl);
				});
				response.pipe(file).on('finish', () => {
					resolve(filePath);
				});
			}).on('error', (err: string) => {
				logger.log('Could not get server icon.');
				logger.log(err);
				logger.reportSentry(err);
				resolve(defaultIconUrl);
			});
		} catch (err) {
			logger.log('Could not get server icon.');
			logger.log(err);
			logger.reportSentry(err);
			resolve(defaultIconUrl);
		}
	});
}

export async function updateSavedServer(url: string, index: number): Promise<void> {
	// Does not promise successful update
	const oldIcon = getDomain(index).icon;
	const { ignoreCerts } = getDomain(index);
	try {
		const newServerConf = await checkDomain(url, ignoreCerts, true);
		const localIconUrl = await saveServerIcon(newServerConf, ignoreCerts);
		if (!oldIcon || localIconUrl !== '../renderer/img/icon.png') {
			newServerConf.icon = localIconUrl;
			updateDomain(index, newServerConf);
			reloadDB();
		}
	} catch (err) {
		ipcRenderer.send('forward-message', 'show-network-error', index);
	}
}

export function reloadDB(): void {
	const domainJsonPath = path.join(app.getPath('userData'), 'config/domain.json');
	try {
		const file = fs.readFileSync(domainJsonPath, 'utf8');
		JSON.parse(file);
	} catch (err) {
		if (fs.existsSync(domainJsonPath)) {
			fs.unlinkSync(domainJsonPath);
			dialog.showErrorBox(
				'Error saving new organization',
				'There seems to be error while saving new organization, ' +
				'you may have to re-add your previous organizations back.'
			);
			logger.error('Error while JSON parsing domain.json: ');
			logger.error(err);
			logger.reportSentry(err);
		}
	}
	db = new JsonDB(domainJsonPath, true, true);
}

function generateFilePath(url: string): string {
	const dir = `${app.getPath('userData')}/server-icons`;
	const extension = path.extname(url).split('?')[0];

	let hash = 5381;
	let { length } = url;

	while (length) {
		hash = (hash * 33) ^ url.charCodeAt(--length);
	}

	// Create 'server-icons' directory if not existed
	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir);
	}

	return `${dir}/${hash >>> 0}${extension}`;
}

export function formatUrl(domain: string): string {
	if (domain.startsWith('http://') || domain.startsWith('https://')) {
		return domain;
	}
	if (domain.startsWith('localhost:')) {
		return `http://${domain}`;
	}
	return `https://${domain}`;
}
