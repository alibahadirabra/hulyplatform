import { expect, Page } from '@playwright/test'

export class CommonPage {
  async selectMenuItem (page: Page, name: string): Promise<void> {
    if (name !== 'first') {
      await page.locator('div.selectPopup input').fill(name.split(' ')[0])
    }
    await page.locator('div.selectPopup div.list-item:first-child').click()
  }

  async pressCreateButtonSelectPopup (page: Page): Promise<void> {
    await page.locator('div.selectPopup div.header button:last-child').click()
  }

  async pressShowAllButtonSelectPopup (page: Page): Promise<void> {
    await page.locator('div.selectPopup div.header button:nth-of-type(1)').click()
  }

  async selectFromDropdown (page: Page, point: string): Promise<void> {
    await page.locator('div[class$="opup"] span[class*="label"]', { hasText: point }).click()
  }

  async fillToDropdown (page: Page, input: string): Promise<void> {
    await page.locator('div.popup input.search').fill(input)
    await page.locator('div.popup button#channel-ok').click()
  }

  async fillToSelectPopup (page: Page, input: string): Promise<void> {
    await page.locator('div.selectPopup input').fill(input)
    await page.locator('div.selectPopup button').click()
  }

  async checkFromDropdown (page: Page, point: string): Promise<void> {
    await page.locator('div.selectPopup span[class^="lines"]', { hasText: point }).click()
  }

  async pressYesDeletePopup (page: Page): Promise<void> {
    await page.locator('form[id="view:string:DeleteObject"] button.primary').click()
  }

  async addNewTagPopup (page: Page, title: string, description: string): Promise<void> {
    await page.locator('div.popup form[id="tags:string:AddTag"] input[placeholder$="title"]').fill(title)
    await page
      .locator('div.popup form[id="tags:string:AddTag"] input[placeholder="Please type description here"]')
      .fill(description)
    await page.locator('div.popup form[id="tags:string:AddTag"] button[type="submit"]').click()
  }

  async selectAssignee (page: Page, name: string): Promise<void> {
    if (name !== 'first') {
      await page.locator('div.selectPopup input').fill(name.split(' ')[0])
    }
    await page.locator('div.selectPopup div.list-item').click()
  }

  async checkError (page: Page, errorMessage: string): Promise<void> {
    await expect(page.locator('div.ERROR span')).toHaveText(errorMessage)
  }
}
