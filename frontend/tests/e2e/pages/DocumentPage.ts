import { type Page, type Locator } from '@playwright/test'

export class DocumentPage {
  readonly page: Page
  readonly workspace: Locator
  readonly title: Locator

  constructor(page: Page) {
    this.page = page
    this.workspace = page.getByTestId('document-workspace')
    this.title = page.getByTestId('document-title')
  }

  async waitForLoad() {
    await this.workspace.waitFor({ state: 'visible' })
  }

  async openTab(tab: 'notes' | 'flashcards' | 'quiz' | 'mindmap' | 'timeline') {
    await this.page.getByTestId(`tab-${tab}`).click()
  }
}
