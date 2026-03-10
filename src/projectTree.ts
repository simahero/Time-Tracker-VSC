import * as vscode from 'vscode'

export class ProjectTreeDataProvider implements vscode.TreeDataProvider<ProjectItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<ProjectItem | undefined | void> = new vscode.EventEmitter<ProjectItem | undefined | void>()
	readonly onDidChangeTreeData: vscode.Event<ProjectItem | undefined | void> = this._onDidChangeTreeData.event

	private filterText: string = ''
	private viewMode: 'daily' | 'monthly' = 'daily'
	private unit: 'minutes' | 'hours' = 'minutes'

	constructor(private context: vscode.ExtensionContext) {
		const savedMode = this.context.globalState.get<'daily' | 'monthly'>('timeTracker.viewMode')
		const savedUnit = this.context.globalState.get<'minutes' | 'hours'>('timeTracker.unit')
		const savedFilter = this.context.globalState.get<string>('timeTracker.filter')
		if (savedMode) this.viewMode = savedMode
		if (savedUnit) this.unit = savedUnit
		if (savedFilter) this.filterText = savedFilter
	}

	refresh(): void {
		this._onDidChangeTreeData.fire()
	}

	getTreeItem(element: ProjectItem): vscode.TreeItem {
		return element
	}

	setFilter(text?: string) {
		this.filterText = text ? text : ''
		this.context.globalState.update('timeTracker.filter', this.filterText)
		this.refresh()
	}

	clearFilter() {
		this.setFilter('')
	}

	setViewMode(mode: 'daily' | 'monthly') {
		this.viewMode = mode
		this.context.globalState.update('timeTracker.viewMode', mode)
		this.refresh()
	}

	getViewMode(): 'daily' | 'monthly' {
		return this.viewMode
	}

	setUnit(unit: 'minutes' | 'hours') {
		this.unit = unit
		this.context.globalState.update('timeTracker.unit', unit)
		this.refresh()
	}

	getUnit(): 'minutes' | 'hours' {
		return this.unit
	}

	private formatValue(minutes: number): string {
		if (this.unit === 'hours') {
			const h = minutes / 60
			return `${h.toFixed(2)} h`
		}
		return `${minutes} min`
	}

	getChildren(element?: ProjectItem): Thenable<ProjectItem[]> {
		const db = this.context.globalState.get<Record<string, Record<string, number>>>('timeTrackerDB') || {}
		const items: ProjectItem[] = []
		if (!element) {
			const projects = Object.keys(db).filter((p) => p !== 'overall')
			const filtered = projects.filter((p) => p.toLowerCase().includes(this.filterText.toLowerCase()))
			for (const project of filtered) {
				let acc = 0
				for (const day in db[project]) {
					acc += db[project][day]
				}
				const label = `${project}`
				const description = `${this.formatValue(acc)} overall`
				const item = new ProjectItem(label, description, project, vscode.TreeItemCollapsibleState.Collapsed)
				item.contextValue = 'project'
				items.push(item)
			}
		} else if (element.projectKey && db[element.projectKey]) {
			// Child: show either per-day entries or aggregated per-month entries
			if (this.viewMode === 'daily') {
				const days = Object.keys(db[element.projectKey]).sort((a, b) => b.localeCompare(a))
				for (const day of days) {
					const minutes = db[element.projectKey][day]
					const label = `${day}`
					const description = this.formatValue(minutes)
					const item = new ProjectItem(label, description)
					item.parentKey = element.projectKey
					item.contextValue = 'entry'
					items.push(item)
				}
			} else {
				// monthly aggregation: group by YYYY.MM
				const monthsMap: Record<string, number> = {}
				for (const day in db[element.projectKey]) {
					const month = day.slice(0, 7) // YYYY.MM
					monthsMap[month] = (monthsMap[month] || 0) + db[element.projectKey][day]
				}
				const months = Object.keys(monthsMap).sort((a, b) => b.localeCompare(a))
				for (const month of months) {
					const minutes = monthsMap[month]
					const label = `${month}`
					const description = this.formatValue(minutes)
					const item = new ProjectItem(label, description)
					item.parentKey = element.projectKey
					item.contextValue = 'entry'
					items.push(item)
				}
			}
		}
		return Promise.resolve(items)
	}
}

export class ProjectItem extends vscode.TreeItem {
	/** For project rows: the project key. For entry rows: undefined (use parentKey). */
	public parentKey?: string

	constructor(
		public readonly label: string,
		public readonly description?: string,
		public readonly projectKey?: string,
		collapsibleState: vscode.TreeItemCollapsibleState = vscode.TreeItemCollapsibleState.None,
	) {
		super(label, collapsibleState)
		this.description = description
	}
}

// Add this function to allow external refresh
export function registerProjectTreeProvider(context: vscode.ExtensionContext): ProjectTreeDataProvider {
	const provider = new ProjectTreeDataProvider(context)
	vscode.window.createTreeView('timeTrackerProjects', {
		treeDataProvider: provider,
		showCollapseAll: true,
	})
	return provider
}
