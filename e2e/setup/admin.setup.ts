import { test as setup, expect } from '@playwright/test'

const ADMIN_EMAIL = 'test@revenia.com'
const ADMIN_PASSWORD = 'password123'

setup.setTimeout(60000)

setup('authenticate as admin', async ({ page }) => {
  await page.goto('/login', { timeout: 45000 })

  await page.locator('#email').fill(ADMIN_EMAIL)
  await page.locator('#password').fill(ADMIN_PASSWORD)

  await page.getByRole('button', { name: 'Iniciar Sesión' }).click()

  await page.waitForURL('**/dashboard', { timeout: 30000 })
  await expect(page).toHaveURL(/dashboard/)

  // Dismiss onboarding overlays so authenticated tests don't get blocked
  await page.evaluate(() => {
    localStorage.setItem('revenia_tour_completed', 'true')
    // Dismiss user-specific onboarding for this user
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key?.startsWith('revenia_onboarding_completed_')) {
        localStorage.setItem(key, 'true')
      }
    }
    // Also set for the known test user ID
    localStorage.setItem('revenia_onboarding_completed_11111111-1111-1111-1111-111111111111', 'true')
  })

  await page.context().storageState({ path: './e2e/.auth/admin.json' })
})
