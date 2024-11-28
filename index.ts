import { chromium } from 'playwright';
(async () => {
  // SETUP
  const browser = await chromium.launch();
  const context = await browser.newContext({
    bypassCSP: true,
  });
  const page = await context.newPage();
  await page.goto('https://www.jobs.ch/en/vacancies/?region=2&term=');
  const jobList = await page.getByLabel('Job list').locator('div');
console.log('job list', jobList)
  for (const li of jobList) {
   return li
  };

  await browser.close();
  
})();
