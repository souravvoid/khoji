import { test as base, type Page } from '@playwright/test'
import { tauriMock } from './tauriMock'

/**
 * Extended test fixture that installs the Tauri IPC mock before every
 * navigation, so the app runs in a browser without the Rust backend.
 */
export const test = base.extend<{ mockedPage: Page }>({
  mockedPage: async ({ page }, done) => {
    await page.addInitScript(tauriMock)
    await done(page)
  },
})

export { expect } from '@playwright/test'
