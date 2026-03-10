// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { ProjectTreeDataProvider, registerProjectTreeProvider } from './projectTree'
import { getTodayKey, getProjectKey } from './timeUtils'
import { updateDatabase, getTrackedMinutes, syncToLocalFile, loadFromLocalFile, autoSync } from './storage'

let statusBarItem: vscode.StatusBarItem
let interval: NodeJS.Timeout | undefined
let startTime: number
let projectTreeProvider: ProjectTreeDataProvider | undefined = undefined

function updateStatusBar(context: vscode.ExtensionContext) {
	const minutes = getTrackedMinutes(context)
	statusBarItem.text = `$(clock) ${getProjectKey()}: ${minutes} min`
	statusBarItem.show()
}

export function activate(context: vscode.ExtensionContext) {
	statusBarItem = vscode.window.createStatusBarItem('time-tracker-status', vscode.StatusBarAlignment.Left, 100)
	context.subscriptions.push(statusBarItem)
	updateStatusBar(context)

	startTime = Date.now()
	interval = setInterval(() => {
		updateDatabase(context, 1, () => projectTreeProvider?.refresh())
		updateStatusBar(context)
	}, 60000)

	setInterval(() => {
		autoSync(context)
	}, 300000)

	projectTreeProvider = registerProjectTreeProvider(context)

	context.subscriptions.push(vscode.commands.registerCommand('time-tracker.syncToLocalFile', () => syncToLocalFile(context)))
	context.subscriptions.push(vscode.commands.registerCommand('time-tracker.loadFromLocalFile', () => loadFromLocalFile(context)))

	// New commands for search, clear, delete, and toggles
	context.subscriptions.push(
		vscode.commands.registerCommand('time-tracker.searchProjects', async () => {
			if (!projectTreeProvider) return
			const q = await vscode.window.showInputBox({ prompt: 'Filter projects (substring)', placeHolder: 'Type to filter projects' })
			projectTreeProvider.setFilter(q)
		}),
	)

	// clearSearch and deleteProject commands removed — deletion managed differently per UX

	context.subscriptions.push(
		vscode.commands.registerCommand('time-tracker.toggleViewMode', () => {
			if (!projectTreeProvider) return
			const current = projectTreeProvider.getViewMode()
			projectTreeProvider.setViewMode(current === 'daily' ? 'monthly' : 'daily')
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand('time-tracker.toggleUnit', () => {
			if (!projectTreeProvider) return
			const current = projectTreeProvider.getUnit()
			projectTreeProvider.setUnit(current === 'minutes' ? 'hours' : 'minutes')
		}),
	)

	// Deletion commands — triggered from inline tree item buttons; VS Code passes the ProjectItem as arg
	context.subscriptions.push(
		vscode.commands.registerCommand('time-tracker.deleteEntry', async (item: import('./projectTree').ProjectItem) => {
			const projectKey = item.parentKey
			const entryKey = item.label as string
			if (!projectKey) return
			const db = context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}
			if (!db[projectKey]) return
			// Monthly keys are YYYY.MM (len 7), daily are YYYY.MM.DD (len 10)
			const isMonth = entryKey.length === 7
			const label = isMonth ? `${entryKey} (month)` : entryKey
			const choice = await vscode.window.showWarningMessage(`Delete ${label} from ${projectKey}?`, { modal: true }, 'Delete')
			if (choice !== 'Delete') return
			if (!isMonth) {
				delete db[projectKey][entryKey]
			} else {
				for (const day of Object.keys(db[projectKey])) {
					if (day.slice(0, 7) === entryKey) delete db[projectKey][day]
				}
			}
			await context.globalState.update('timeTrackerDB', db)
			projectTreeProvider?.refresh()
		}),
	)

	context.subscriptions.push(
		vscode.commands.registerCommand('time-tracker.deleteProject', async (item: import('./projectTree').ProjectItem) => {
			const projectKey = item.projectKey
			if (!projectKey) return
			const db = context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}
			if (!db[projectKey]) return
			const choice = await vscode.window.showWarningMessage(`Delete entire project "${projectKey}"?`, { modal: true }, 'Delete')
			if (choice !== 'Delete') return
			delete db[projectKey]
			await context.globalState.update('timeTrackerDB', db)
			projectTreeProvider?.refresh()
		}),
	)
}

export function deactivate() {
	if (interval) clearInterval(interval)
	if (statusBarItem) statusBarItem.dispose()
}
