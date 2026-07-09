import { type Page, type Locator } from '@playwright/test'

export class LibraryPage {
  readonly page: Page
  readonly view: Locator
  readonly emptyState: Locator
  readonly count: Locator
  readonly cards: Locator

  constructor(page: Page) {
    this.page = page
    this.view = page.getByTestId('library-view')
    this.emptyState = page.getByTestId('library-empty')
    this.count = page.getByTestId('library-count')
    this.cards = page.getByTestId('document-card')
  }

  async goto() {
    await this.page.goto('/')
    await this.view.waitFor({ state: 'visible' })
  }

  async getCardCount() {
    return await this.cards.count()
  }

  async openDocument(title: string) {
    await this.cards.filter({ hasText: title }).first().click()
  }
}
