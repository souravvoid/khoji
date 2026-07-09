import { test, expect } from './fixtures/test'
import { LibraryPage } from './pages/LibraryPage'
import { DocumentPage } from './pages/DocumentPage'

test.describe('Document workspace', () => {
  let library: LibraryPage
  let documentPage: DocumentPage

  test.beforeEach(async ({ mockedPage }) => {
    library = new LibraryPage(mockedPage)
    documentPage = new DocumentPage(mockedPage)
    await library.goto()
    await library.openDocument('History of Rome')
    await documentPage.waitForLoad()
  })

  test('opens with the document title', async () => {
    await expect(documentPage.title).toContainText('History of Rome')
  })

  test('switches to the flashcards tab', async () => {
    await documentPage.openTab('flashcards')
    await expect(documentPage.page.getByTestId('tab-flashcards')).toHaveAttribute('class', /font-bold/)
  })

  test('switches to the quiz tab', async () => {
    await documentPage.openTab('quiz')
    await expect(documentPage.page.getByTestId('tab-quiz')).toHaveAttribute('class', /font-bold/)
  })

  test('returns to the library on back', async ({ mockedPage }) => {
    await mockedPage.getByRole('button', { name: 'Back to library' }).click()
    await expect(mockedPage.getByTestId('library-view')).toBeVisible()
  })
})
