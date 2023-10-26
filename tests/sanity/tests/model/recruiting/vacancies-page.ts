import { expect, type Locator, type Page } from '@playwright/test'
import { NewVacancy, TalentName } from './types'
import { generateId } from '../../utils'
import { CommonRecruitingPage } from './common-recruiting-page'

export class VacanciesPage extends CommonRecruitingPage {
  readonly page: Page
  readonly pageHeader: Locator
  readonly buttonCreateNewVacancy: Locator
  readonly textTableFirstCell: Locator
  readonly inputCreateVacancyTitle: Locator
  readonly inputCreateVacancyDescription: Locator
  readonly buttonCreateVacancyLocation: Locator
  readonly buttonCreateVacancy: Locator

  constructor (page: Page) {
    super(page)
    this.page = page
    this.pageHeader = page.locator('span[class*="header"]', { hasText: 'Vacancies' })
    this.buttonCreateNewVacancy = page.locator('button > span', { hasText: 'Vacancy' })
    this.textTableFirstCell = page.locator('div[class$="firstCell"]')
    this.inputCreateVacancyTitle = page.locator('form[id="recruit:string:CreateVacancy"] input[type="text"]')
    this.inputCreateVacancyDescription = page.locator('form[id="recruit:string:CreateVacancy"] div.text-editor-view')
    this.buttonCreateVacancyLocation = page.locator('form[id="recruit:string:CreateVacancy"] button span', { hasText: 'Location' })
    this.buttonCreateVacancy = page.locator('form[id="recruit:string:CreateVacancy"] button[type="submit"]')
  }

  async createNewVacancy ({ title, description, location }: NewVacancy): Promise<void> {
    await this.buttonCreateNewVacancy.click()

    await this.inputCreateVacancyTitle.fill(title)
    await this.inputCreateVacancyDescription.fill(description)
    if (location != null) {
      await this.buttonCreateVacancyLocation.click()
      await this.fillToSelectPopup(this.page, location)
    }

    await this.buttonCreateVacancy.click()
  }

  async openVacancyByName (vacancyName: string): Promise<void> {
    await this.page
      .locator('tr', { hasText: vacancyName })
      .locator('div[class$="firstCell"]')
      .click()
  }

  async checkVacancyNotExist (vacancyName: string): Promise<void> {
    await expect(this.page.locator('tr', { hasText: vacancyName })).toHaveCount(0)
  }
}

