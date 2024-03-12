import { expect, test } from '@playwright/test'
import { generateId, getSecondPage, PlatformSetting, PlatformURI } from '../utils'
import { NewDocument, NewTeamspace } from '../model/documents/types'
import { LeftSideMenuPage } from '../model/left-side-menu-page'
import { DocumentsPage } from '../model/documents/documents-page'
import { DocumentContentPage } from '../model/documents/document-content-page'
import { PublicLinkPopup } from '../model/tracker/public-link-popup'
import { IssuesDetailsPage } from '../model/tracker/issues-details-page'

test.describe('Documents link tests', () => {
  test('Document public link revoke', async ({ browser }) => {
    let link: string
    const publicLinkDocument: NewDocument = {
      title: `Document Public link revoke-${generateId()}`,
      space: 'Default'
    }

    const newContext = await browser.newContext({ storageState: PlatformSetting })
    const page = await newContext.newPage()
    await (await page.goto(`${PlatformURI}/workbench/sanity-ws`))?.finished()

    const leftSideMenuPage = new LeftSideMenuPage(page)
    await leftSideMenuPage.buttonDocuments.click()

    const documentsPage = new DocumentsPage(page)
    await documentsPage.buttonCreateDocument.click()

    await documentsPage.createDocument(publicLinkDocument)
    await documentsPage.openDocument(publicLinkDocument.title)

    const documentContentPage = new DocumentContentPage(page)
    await documentContentPage.executeMoreAction('Public link')

    const publicLinkPopup = new PublicLinkPopup(page)
    link = await publicLinkPopup.getPublicLink()

    const clearSession = await browser.newContext()
    const clearPage = await clearSession.newPage()
    await test.step('Check guest access to the document', async () => {
      await clearPage.goto(link)

      const documentContentClearPage = new DocumentContentPage(clearPage)
      await documentContentClearPage.checkDocumentTitle(publicLinkDocument.title)
      expect(clearPage.url()).toContain('guest')
    })

    await test.step('Revoke guest access to the document', async () => {
      const publicLinkPopup = new PublicLinkPopup(page)
      await publicLinkPopup.revokePublicLink()
    })

    await test.step('Check guest access to the document after the revoke', async () => {
      await clearPage.goto(link)
      await expect(clearPage.locator('div.antiPopup > h1')).toHaveText('Public link was revoked')
    })
  })
})
