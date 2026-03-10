import * as vscode from 'vscode'

export function getTodayKey(): string {
    const today = new Date()
    const year = today.getFullYear()
    const month = String(today.getMonth() + 1).padStart(2, '0')
    const day = String(today.getDate()).padStart(2, '0')
    return `${year}.${month}.${day}`
}

export function getProjectKey(): string {
    return vscode.workspace.name || 'unknown-project'
}
