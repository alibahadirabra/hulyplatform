import { test } from '@playwright/test'
import { generateId, PlatformSetting, PlatformURI } from './utils'

test.use({
  storageState: PlatformSetting
})

test.describe('recruit tests', () => {
  test.beforeEach(async ({ page }) => {
    // Create user and workspace
    await page.goto(`${PlatformURI}/workbench%3Acomponent%3AWorkbenchApp/sanity-ws`)
  })

  test('org-add-member', async ({ page }) => {
    await page.click('[id="app-contact\\:string\\:Contacts"]')
    await page.click('button:has-text("Contact")')
    await page.click('button:has-text("Organization")')
    await page.click('[placeholder="Apple"]')
    const orgId = 'Organiation-' + generateId()
    await page.fill('[placeholder="Apple"]', orgId)
    await page.click('button:has-text("Create")')
    await page.waitForSelector('form.antiCard', { state: 'detached' })
    await page.click(`text=${orgId}`)

    await page.click('[id="contact:string:AddMember"]')
    await page.click('button:has-text("Rosamund Chen")')
    await page.click('text=Rosamund Chen less than a minute ago >> span')
    await page.click(`:nth-match(:text("${orgId}"), 2)`)
  })
})
