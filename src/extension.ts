// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { ProjectTreeDataProvider, registerProjectTreeProvider } from './projectTree'

let statusBarItem: vscode.StatusBarItem
let interval: NodeJS.Timeout | undefined
let startTime: number
let syncFilePath: string | undefined = undefined
let projectTreeProvider: ProjectTreeDataProvider | undefined = undefined

function getTodayKey(): string {
	const today = new Date()
	const year = today.getFullYear()
	const month = String(today.getMonth() + 1).padStart(2, '0')
	const day = String(today.getDate()).padStart(2, '0')
	return `${year}.${month}.${day}`
}

function getProjectKey(): string {
	return vscode.workspace.name || 'unknown-project'
}

function updateDatabase(context: vscode.ExtensionContext, minutes: number) {
	const todayKey = getTodayKey()
	const projectKey = getProjectKey()
	const db = context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}

	if (!db[projectKey]) db[projectKey] = {}
	db[projectKey][todayKey] = (db[projectKey][todayKey] || 0) + minutes

	context.globalState.update('timeTrackerDB', db)
	if (projectTreeProvider) projectTreeProvider.refresh()
}

function getTrackedMinutes(context: vscode.ExtensionContext): number {
	const todayKey = getTodayKey()
	const projectKey = getProjectKey()
	const db = context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}
	return db[projectKey]?.[todayKey] || 0
}

function updateStatusBar(context: vscode.ExtensionContext) {
	const minutes = getTrackedMinutes(context)
	statusBarItem.text = `$(clock) ${getProjectKey()}: ${minutes} min`
	statusBarItem.show()
}

export async function syncToLocalFile(context: vscode.ExtensionContext) {
	const db = context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}
	const uri = await vscode.window.showSaveDialog({
		saveLabel: 'Save Time Tracker Data',
		filters: { JSON: ['json'] },
		defaultUri: vscode.Uri.file(path.join(process.env.HOME || process.env.USERPROFILE || '.', 'vscode-time-tracker.json')),
	})
	if (!uri) return
	syncFilePath = uri.fsPath
	context.globalState.update('timeTrackerSyncPath', syncFilePath)
	try {
		fs.writeFileSync(syncFilePath, JSON.stringify(db, null, 2), 'utf8')
		vscode.window.showInformationMessage(`Time Tracker data synced to ${syncFilePath}`)
	} catch (err) {
		vscode.window.showErrorMessage('Failed to sync time tracker data: ' + err)
	}
}

export async function loadFromLocalFile(context: vscode.ExtensionContext) {
	const uri = await vscode.window.showOpenDialog({
		canSelectMany: false,
		filters: { JSON: ['json'] },
		title: 'Select Time Tracker Data File',
	})
	if (!uri || uri.length === 0) return
	try {
		const data = fs.readFileSync(uri[0].fsPath, 'utf8')
		const db = JSON.parse(data)
		context.globalState.update('timeTrackerDB', db)
		syncFilePath = uri[0].fsPath
		context.globalState.update('timeTrackerSyncPath', syncFilePath)
		vscode.window.showInformationMessage('Time Tracker data loaded from local file.')
	} catch (err) {
		vscode.window.showErrorMessage('Failed to load time tracker data: ' + err)
	}
}

function autoSync(context: vscode.ExtensionContext) {
	if (!syncFilePath) {
		syncFilePath = context.globalState.get<string>('timeTrackerSyncPath')
	}
	if (syncFilePath) {
		const db = context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}
		try {
			fs.writeFileSync(syncFilePath, JSON.stringify(db, null, 2), 'utf8')
			console.log(`Auto-synced Time Tracker data to ${syncFilePath}`)
		} catch (err) {
			console.error('Failed to auto-sync time tracker data: ' + err)
		}
	}
}

export function activate(context: vscode.ExtensionContext) {
	statusBarItem = vscode.window.createStatusBarItem('time-tracker-status', vscode.StatusBarAlignment.Left, 100)
	context.subscriptions.push(statusBarItem)
	updateStatusBar(context)

	startTime = Date.now()
	interval = setInterval(() => {
		updateDatabase(context, 1)
		updateStatusBar(context)
	}, 60000)

	syncFilePath = context.globalState.get<string>('timeTrackerSyncPath')

	setInterval(() => {
		autoSync(context)
	}, 300000)

	projectTreeProvider = registerProjectTreeProvider(context)
	vscode.window.createTreeView('timeTrackerProjects', { treeDataProvider: projectTreeProvider })

	context.subscriptions.push(vscode.commands.registerCommand('time-tracker.syncToLocalFile', () => syncToLocalFile(context)))
	context.subscriptions.push(vscode.commands.registerCommand('time-tracker.loadFromLocalFile', () => loadFromLocalFile(context)))
}

export function deactivate() {
	if (interval) clearInterval(interval)
	if (statusBarItem) statusBarItem.dispose()
}
