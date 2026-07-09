import { test, expect } from './fixtures/test'
import { SearchPage } from './pages/SearchPage'

test.describe('Search', () => {
  let search: SearchPage

  test.beforeEach(async ({ mockedPage }) => {
    search = new SearchPage(mockedPage)
    await mockedPage.goto('/')
    await mockedPage.getByTestId('library-view').waitFor({ state: 'visible' })
  })

  test('opens via the top bar button', async () => {
    await search.open()
    await expect(search.modal).toBeVisible()
    await expect(search.input).toBeFocused()
  })

  test('opens via Ctrl+K shortcut', async () => {
    await search.openViaShortcut()
    await expect(search.modal).toBeVisible()
  })

  test('returns matching results', async () => {
    await search.open()
    await search.query('rome')

    await expect(search.resultItems.first()).toBeVisible()
    expect(await search.resultItems.count()).toBeGreaterThan(0)
    await expect(search.resultItems.first()).toContainText(/rome/i)
  })

  test('shows empty state for no matches', async () => {
    await search.open()
    await search.query('zzznonexistent')

    await expect(search.results).toContainText('No results found')
  })

  test('closes on Escape', async () => {
    await search.open()
    await search.close()
    await expect(search.modal).toBeHidden()
  })
})
