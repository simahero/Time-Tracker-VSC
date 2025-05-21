import * as vscode from 'vscode'

export class ProjectTreeDataProvider implements vscode.TreeDataProvider<ProjectItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | void> = new vscode.EventEmitter<ProjectItem | undefined | void>()
	readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | void> = this._onDidChangeTreeData.event

	constructor(private context: vscode.ExtensionContext) {}

	refresh(): void {
		this._onDidChangeTreeData.fire()
	}

	getTreeItem(element: ProjectItem): vscode.TreeItem {
		return element
	}

	getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
		const db = this.context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}
		const items: ProjectItem[] = []
		if (!element) {
			// Top-level: show each project with overall time
			for (const project in db) {
				if (project === 'overall') continue
				let acc = 0
				for (const day in db[project]) {
					acc += db[project][day]
				}
				const label = `${project}`
				const description = `${acc} min overall`
				items.push(new ProjectItem(label, description, project, vscode.TreeItemCollapsibleState.Collapsed))
			}
		} else if (element.projectKey && db[element.projectKey]) {
			// Child: show each day for the selected project, sorted descending
			const days = Object.keys(db[element.projectKey]).sort((a, b) => b.localeCompare(a))
			for (const day of days) {
				const label = `${day}`
				const description = `${db[element.projectKey][day]} min`
				items.push(new ProjectItem(label, description))
			}
		}
		return Promise.resolve(items)
	}
}

export class ProjectItem extends vscode.TreeItem {
	constructor(public readonly label: string, public readonly description?: string, public readonly projectKey?: string, collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None) {
		super(label, collapsibleState)
		this.description = description
	}
}

// Add this function to allow external refresh
export function registerProjectTreeProvider(context: vscode.ExtensionContext): ProjectTreeDataProvider {
	const provider = new ProjectTreeDataProvider(context)
	vscode.window.createTreeView('timeTrackerProjects', { treeDataProvider: provider })
	return provider
}
