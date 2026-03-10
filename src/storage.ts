import * as vscode from 'vscode'
import * as fs from 'fs'
import * as path from 'path'
import { getTodayKey, getProjectKey } from './timeUtils'

export function updateDatabase(context: vscode.ExtensionContext, minutes: number, refresh?: () => void) {
    const todayKey = getTodayKey()
    const projectKey = getProjectKey()
    const db = context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}

    if (!db[projectKey]) db[projectKey] = {}
    db[projectKey][todayKey] = (db[projectKey][todayKey] || 0) + minutes

    context.globalState.update('timeTrackerDB', db)
    if (refresh) refresh()
}

export function getTrackedMinutes(context: vscode.ExtensionContext): number {
    const todayKey = getTodayKey()
    const projectKey = getProjectKey()
    const db = context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}
    return db[projectKey]?.[todayKey] || 0
}

export async function syncToLocalFile(context: vscode.ExtensionContext) {
    const db = context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}
    const uri = await vscode.window.showSaveDialog({
        saveLabel: 'Save Time Tracker Data',
        filters: { JSON: ['json'] },
        defaultUri: vscode.Uri.file(path.join(process.env.HOME || process.env.USERPROFILE || '.', 'vscode-time-tracker.json')),
    })
    if (!uri) return
    const syncFilePath = uri.fsPath
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
        const syncFilePath = uri[0].fsPath
        context.globalState.update('timeTrackerSyncPath', syncFilePath)
        vscode.window.showInformationMessage('Time Tracker data loaded from local file.')
    } catch (err) {
        vscode.window.showErrorMessage('Failed to load time tracker data: ' + err)
    }
}

export function autoSync(context: vscode.ExtensionContext) {
    const syncFilePath = context.globalState.get<string>('timeTrackerSyncPath')
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
