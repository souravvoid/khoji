import { test, expect } from './fixtures/test'
import { LibraryPage } from './pages/LibraryPage'

test.describe('Library', () => {
  let library: LibraryPage

  test.beforeEach(async ({ mockedPage }) => {
    library = new LibraryPage(mockedPage)
    await library.goto()
  })

  test('renders seeded documents', async () => {
    await expect(library.view).toBeVisible()
    expect(await library.getCardCount()).toBeGreaterThan(0)
    await expect(library.cards.first()).toContainText('History of Rome')
  })

  test('shows the document count', async () => {
    await expect(library.count).toContainText('documents')
  })

  test('opens a document into the workspace', async ({ mockedPage }) => {
    await library.openDocument('Quantum Computing Notes')
    await expect(mockedPage.getByTestId('document-workspace')).toBeVisible()
    await expect(mockedPage.getByTestId('document-title')).toContainText('Quantum Computing Notes')
  })
})
