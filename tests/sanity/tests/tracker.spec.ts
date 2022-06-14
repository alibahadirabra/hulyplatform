import { test, expect } from '@playwright/test'
import { generateId, PlatformSetting, PlatformURI } from './utils'
test.use({
  storageState: PlatformSetting
})
test('create-issue-and-sub-issue', async ({ page }) => {
  await page.goto(`${PlatformURI}/workbench%3Acomponent%3AWorkbenchApp`)
  await page.click('[id="app-tracker\\:string\\:TrackerApplication"]')
  await expect(page).toHaveURL(`${PlatformURI}/workbench%3Acomponent%3AWorkbenchApp/tracker%3Aapp%3ATracker`)
  await page.click('button:has-text("New issue")')
  await page.click('[placeholder="Issue\\ title"]')
  await page.fill('[placeholder="Issue\\ title"]', 'test-issue')
  await page.fill('.ProseMirror', 'some description')
  await page.click('button:has-text("Backlog")')
  await page.click('button:has-text("Todo")')
  await page.click('button:has-text("No priority")')
  await page.click('button:has-text("Urgent")')
  await page.click('button:has-text("Save issue")')

  await page.click('.antiNav-element__dropbox :text("Issues")')
  await page.click('.listGrid :has-text("test-issue") span')
  await page.click('#add-sub-issue')
  await page.click('[placeholder="Issue\\ title"]')
  await page.fill('[placeholder="Issue\\ title"]', 'sub-issue')
  await page.fill('.ProseMirror', 'sub-issue description')
  await page.click('#status-editor')
  await page.click('button:has-text("In Progress")')
  await page.click('button:has-text("Assignee")')
  await page.click('.selectPopup button:has-text("John Appleseed")')
  await page.click('button:has-text("Save")')
  await page.click('span.name:text("sub-issue")')
})

test('use-kanban', async ({ page }) => {
  await page.goto(`${PlatformURI}/workbench%3Acomponent%3AWorkbenchApp`)
  await page.click('[id="app-tracker\\:string\\:TrackerApplication"]')
  await expect(page).toHaveURL(`${PlatformURI}/workbench%3Acomponent%3AWorkbenchApp/tracker%3Aapp%3ATracker`)

  const issueName = 'issue-' + generateId(5)
  await page.click('button:has-text("New issue")')
  await page.click('[placeholder="Issue\\ title"]')
  await page.fill('[placeholder="Issue\\ title"]', issueName)
  await page.click('button:has-text("Backlog")')
  await page.click('button:has-text("In Progress")')
  await page.click('button:has-text("Save issue")')

  await page.locator('text="Issues"').click()
  await page.click('[name="tooltip-tracker:string:Board"]')
  await expect(page.locator('.panel-container:has-text("In Progress")')).toContainText(issueName)
})
