import { test, expect } from './fixtures/test'
import { SettingsPage } from './pages/SettingsPage'

test.describe('Settings', () => {
  let settings: SettingsPage

  test.beforeEach(async ({ mockedPage }) => {
    settings = new SettingsPage(mockedPage)
    await mockedPage.goto('/')
    await mockedPage.getByTestId('library-view').waitFor({ state: 'visible' })
  })

  test('opens the settings drawer', async () => {
    await settings.open()
    await expect(settings.drawer).toBeVisible()
    await expect(settings.drawer.getByTestId('settings-section-general')).toBeVisible()
  })

  test('switches between sections', async () => {
    await settings.open()
    await settings.openSection('models')
    await expect(settings.drawer).toContainText('AI Models')
    await settings.openSection('shortcuts')
    await expect(settings.drawer).toContainText('Keyboard Shortcuts')
  })

  test('changes the theme', async () => {
    await settings.open()
    await settings.setTheme('dark')
    await expect(settings.page.locator('html')).toHaveClass(/dark/)
  })

  test('changes the font size', async () => {
    await settings.open()
    await settings.setFontSize('lg')
    await expect(settings.page.locator('html')).toHaveCSS('--reading-font-size', '17px')
  })

  test('closes the drawer', async () => {
    await settings.open()
    await settings.close()
    await expect(settings.drawer).toBeHidden()
  })
})
