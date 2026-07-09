import { type Page, type Locator } from '@playwright/test'

export class SearchPage {
  readonly page: Page
  readonly modal: Locator
  readonly input: Locator
  readonly results: Locator
  readonly resultItems: Locator

  constructor(page: Page) {
    this.page = page
    this.modal = page.getByTestId('search-modal')
    this.input = page.getByTestId('search-input')
    this.results = page.getByTestId('search-results')
    this.resultItems = page.getByTestId('search-result-item')
  }

  async open() {
    await this.page.getByTestId('topbar-search').click()
    await this.modal.waitFor({ state: 'visible' })
  }

  async openViaShortcut() {
    await this.page.keyboard.press('Control+k')
    await this.modal.waitFor({ state: 'visible' })
  }

  async close() {
    await this.page.keyboard.press('Escape')
    await this.modal.waitFor({ state: 'hidden' })
  }

  async query(text: string) {
    await this.input.fill(text)
    // allow the 300ms debounce + mock resolution to settle
    await this.input.page().waitForTimeout(400)
  }
}
