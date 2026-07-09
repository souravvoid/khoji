import { type Page, type Locator } from '@playwright/test'

export class SettingsPage {
  readonly page: Page
  readonly drawer: Locator

  constructor(page: Page) {
    this.page = page
    this.drawer = page.getByTestId('settings-drawer')
  }

  async open() {
    await this.page.getByRole('button', { name: 'Settings' }).click()
    await this.drawer.waitFor({ state: 'visible' })
  }

  async openSection(id: string) {
    await this.drawer.getByTestId(`settings-section-${id}`).click()
  }

  async setTheme(theme: 'light' | 'dark' | 'system') {
    await this.drawer.getByTestId(`theme-${theme}`).click()
  }

  async setFontSize(size: 'sm' | 'md' | 'lg' | 'xl') {
    await this.drawer.getByTestId(`font-size-${size}`).click()
  }

  async close() {
    await this.drawer.getByRole('button', { name: 'Close settings' }).click()
    await this.drawer.waitFor({ state: 'hidden' })
  }
}
