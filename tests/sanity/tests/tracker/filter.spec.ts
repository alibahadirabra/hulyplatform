import { test } from '@playwright/test'
import { generateId, PlatformSetting, PlatformURI } from '../utils'
import { LeftSideMenuPage } from '../model/left-side-menu-page'
import { IssuesPage } from '../model/tracker/issues-page'
import { NewIssue } from '../model/tracker/types'
import { allure } from 'allure-playwright'
import { DEFAULT_STATUSES, DEFAULT_STATUSES_ID, PRIORITIES } from './tracker.utils'

test.use({
  storageState: PlatformSetting
})

test.describe('Tracker filters tests', () => {
  test.beforeEach(async ({ page }) => {
    await allure.parentSuite('Tracker tests')
    await (await page.goto(`${PlatformURI}/workbench/sanity-ws`))?.finished()
  })

  test('Modified date', async ({ page }) => {
    const newIssue: NewIssue = {
      title: `Issue for the Modified filter-${generateId()}`,
      description: 'Issue for the Modified filter',
      status: 'In Progress',
      priority: 'Urgent',
      assignee: 'Appleseed John',
      createLabel: true,
      component: 'No component',
      estimation: '2',
      milestone: 'No Milestone',
      duedate: 'today',
      filePath: 'cat.jpeg'
    }

    const leftSideMenuPage = new LeftSideMenuPage(page)
    await leftSideMenuPage.buttonTracker.click()

    const issuesPage = new IssuesPage(page)
    await issuesPage.modelSelectorAll.click()
    await issuesPage.createNewIssue(newIssue)

    await test.step('Check Filter Today', async () => {
      await issuesPage.selectFilter('Modified date', 'Today')
      await issuesPage.checkFilter('Modified date', 'Today')

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })

    await test.step('Check Filter Yesterday', async () => {
      await issuesPage.updateFilterDimension('Yesterday')
      await issuesPage.checkFilter('Modified date', 'Yesterday')

      await issuesPage.checkFilteredIssueNotExist(newIssue.title)
    })

    await test.step('Check Filter This week', async () => {
      await issuesPage.updateFilterDimension('This week')
      await issuesPage.checkFilter('Modified date', 'This week')

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })

    await test.step('Check Filter This month', async () => {
      await issuesPage.updateFilterDimension('This month')
      await issuesPage.checkFilter('Modified date', 'This month')

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })

    await test.step('Check Filter Exact date - Today', async () => {
      await issuesPage.updateFilterDimension('Exact date', 'Today')
      await issuesPage.checkFilter('Modified date', 'is', 'Today')

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })

    await test.step('Check Filter Before date - Today', async () => {
      await issuesPage.updateFilterDimension('Before date')
      await issuesPage.checkFilter('Modified date', 'Before', 'Today')

      await issuesPage.checkFilteredIssueNotExist(newIssue.title)
    })

    await test.step('Check Filter After date - Today', async () => {
      await issuesPage.updateFilterDimension('After date')
      await issuesPage.checkFilter('Modified date', 'After', 'Today')

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })

    await test.step('Check Filter Check Filter Between Dates', async () => {
      await issuesPage.updateFilterDimension('Between dates')
      const dateYesterday = new Date()
      dateYesterday.setDate(dateYesterday.getDate() - 1)
      const dateTomorrow = new Date()
      dateTomorrow.setDate(dateTomorrow.getDate() + 1)

      const dateYesterdayString = `${dateYesterday.getDate().toString().padStart(2, '0')}${(
        dateYesterday.getMonth() + 1
      )
        .toString()
        .padStart(2, '0')}${dateYesterday.getFullYear()}`
      const dateTomorrowString = `${dateTomorrow.getDate().toString().padStart(2, '0')}${(dateTomorrow.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${dateTomorrow.getFullYear()}`

      await issuesPage.fillBetweenDate(dateYesterdayString, dateTomorrowString)
      await issuesPage.checkFilter('Modified date', 'is between', dateYesterday.getDate().toString())
      await issuesPage.checkFilter('Modified date', 'is between', dateTomorrow.getDate().toString())

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })
  })

  test('Created date', async ({ page }) => {
    const newIssue: NewIssue = {
      title: `Issue for the Created filter-${generateId()}`,
      description: 'Issue for the Created filter',
      status: 'In Progress',
      priority: 'Urgent',
      assignee: 'Appleseed John',
      createLabel: true,
      component: 'No component',
      estimation: '2',
      milestone: 'No Milestone',
      duedate: 'today',
      filePath: 'cat.jpeg'
    }

    const leftSideMenuPage = new LeftSideMenuPage(page)
    await leftSideMenuPage.buttonTracker.click()

    const issuesPage = new IssuesPage(page)
    await issuesPage.modelSelectorAll.click()
    await issuesPage.createNewIssue(newIssue)

    await test.step('Check Filter Today', async () => {
      await issuesPage.selectFilter('Created date', 'Today')
      await issuesPage.checkFilter('Created date', 'Today')

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })

    await test.step('Check Filter Yesterday', async () => {
      await issuesPage.updateFilterDimension('Yesterday')
      await issuesPage.checkFilter('Created date', 'Yesterday')

      await issuesPage.checkFilteredIssueNotExist(newIssue.title)
    })

    await test.step('Check Filter This week', async () => {
      await issuesPage.updateFilterDimension('This week')
      await issuesPage.checkFilter('Created date', 'This week')

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })

    await test.step('Check Filter This month', async () => {
      await issuesPage.updateFilterDimension('This month')
      await issuesPage.checkFilter('Created date', 'This month')

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })

    await test.step('Check Filter Exact date - Today', async () => {
      await issuesPage.updateFilterDimension('Exact date', 'Today')
      await issuesPage.checkFilter('Created date', 'is', 'Today')

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })

    await test.step('Check Filter Before date - Today', async () => {
      await issuesPage.updateFilterDimension('Before date')
      await issuesPage.checkFilter('Created date', 'Before', 'Today')

      await issuesPage.checkFilteredIssueNotExist(newIssue.title)
    })

    await test.step('Check Filter After date - Today', async () => {
      await issuesPage.updateFilterDimension('After date')
      await issuesPage.checkFilter('Created date', 'After', 'Today')

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })

    await test.step('Check Filter Between Dates', async () => {
      await issuesPage.updateFilterDimension('Between dates')
      const dateYesterday = new Date()
      dateYesterday.setDate(dateYesterday.getDate() - 1)
      const dateTomorrow = new Date()
      dateTomorrow.setDate(dateTomorrow.getDate() + 1)

      const dateYesterdayString = `${dateYesterday.getDate().toString().padStart(2, '0')}${(
        dateYesterday.getMonth() + 1
      )
        .toString()
        .padStart(2, '0')}${dateYesterday.getFullYear()}`
      const dateTomorrowString = `${dateTomorrow.getDate().toString().padStart(2, '0')}${(dateTomorrow.getMonth() + 1)
        .toString()
        .padStart(2, '0')}${dateTomorrow.getFullYear()}`

      await issuesPage.fillBetweenDate(dateYesterdayString, dateTomorrowString)
      await issuesPage.checkFilter('Created date', 'is between', dateYesterday.getDate().toString())
      await issuesPage.checkFilter('Created date', 'is between', dateTomorrow.getDate().toString())

      await issuesPage.checkFilteredIssueExist(newIssue.title)
    })
  })

  test('Status filter', async ({ page }) => {
    const leftSideMenuPage = new LeftSideMenuPage(page)
    await leftSideMenuPage.buttonTracker.click()

    const issuesPage = new IssuesPage(page)
    await issuesPage.modelSelectorAll.click()

    for (const status of DEFAULT_STATUSES) {
      await test.step(`Status Filter ${status}`, async () => {
        await issuesPage.selectFilter('Status', status)
        await issuesPage.inputSearch.press('Escape')

        await issuesPage.checkFilter('Status', 'is')
        await issuesPage.checkAllIssuesInStatus(DEFAULT_STATUSES_ID.get(status))
        await issuesPage.buttonClearFilers.click()
      })
    }
  })

  test('Priority filter', async ({ page }) => {
    const leftSideMenuPage = new LeftSideMenuPage(page)
    await leftSideMenuPage.buttonTracker.click()

    const issuesPage = new IssuesPage(page)
    await issuesPage.modelSelectorAll.click()

    for (const priority of PRIORITIES) {
      await test.step(`Priority Filter ${priority}`, async () => {
        await issuesPage.selectFilter('Priority', priority)
        await issuesPage.inputSearch.press('Escape')

        await issuesPage.checkFilter('Priority', 'is')
        await issuesPage.checkAllIssuesByPriority(priority.toLowerCase().replaceAll(' ', ''))
        await issuesPage.buttonClearFilers.click()
      })
    }
  })
})
