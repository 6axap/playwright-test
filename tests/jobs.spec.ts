import { test, expect } from "@playwright/test";

test("CLICK 1ST JOB LINK", async ({ page }) => {
  await page.goto("https://www.jobs.ch/en/vacancies/?region=2&term=");
  const searchedJobs = page.locator('[data-feat="searched_jobs"]');
  const jobLink = searchedJobs.locator('[data-cy="job-link"]');

  await jobLink.first().waitFor(); // Wait for locator to be visible
  await jobLink.first().click();
  const jobUrl = await jobLink.first().getAttribute("href");
  console.log("jobUrl", jobUrl);
});

test("TEST 1", async ({ page }) => {
  await page.goto("https://www.jobs.ch/en/vacancies/?region=2&term=");
  const searchedJobs = page.locator('[data-feat="searched_jobs"]');
  // const jobListTexts = await searchedJobs.allInnerTexts();
  const jobLocators = await searchedJobs.all();

  const sortJobs = await Promise.all(
    jobLocators.map(async (jobLocator) => {
      const innerTexts = await jobLocator.allInnerTexts();
      const lines = innerTexts // Clean Lines
        .join("\n")
        .split("\n")
        .filter((line) => line.trim() !== ""); // Remove empty lines
      if (lines[2] == 'Quick apply') {
        lines.splice(2, 1);
      }

      const jobLink = jobLocator.locator('[data-cy="job-link"]'); // Get URL
      const jobUrl = await jobLink.getAttribute("href");

      await jobLink.click();
      const jobContent = page.locator('[data-cy="vacancy-description"]');

      return {
        published: lines[0].replace("Published: ", "").trim(),
        // date: lines[1].trim(),
        title: lines[2].trim(),
        location: lines[3].trim(),
        workload: lines[4].trim(),
        contract: lines[5].trim(),
        company: lines[6].trim(),
        url: 'jobs.ch' + jobUrl,
      };
    }),
  );

  // const jobLink = searchedJobs.getByRole('link').click();
  // console.log(JSON.stringify(sortJobs, null, 2));
});

test.describe("JOBS TEST", () => {
  test("TEST STABLE", async ({ page }) => {
    await page.goto("https://www.jobs.ch/en/vacancies/?region=2&term=");

    // const boostedJobs = page.locator('[data-feat="boosted_jobs"]');
    // const jobList = await searchedJobs.or(boostedJobs).allInnerTexts();
    const searchedJobs = page.locator('[data-feat="searched_jobs"]');
    const jobListTexts = await searchedJobs.allInnerTexts();
    const jobListLocators = await searchedJobs.all();
    console.log("jobList all", jobListLocators);
    console.log("jobList allInnerTxts", jobListTexts);
    // const array: string[] = [];

    const structuredJobList = jobListTexts.map((item) => {
      const lines = item.split("\n").filter((line) => line.trim() !== ""); // Remove empty lines
      return {
        published: lines[0].replace("Published: ", "").trim(),
        // date: lines[1].trim(),
        title: lines[2].trim(),
        location: lines[3].trim(),
        workload: lines[4].trim(),
        contract: lines[5].trim(),
        company: lines[6].trim(),
      };
    });

    // const jobLink = searchedJobs.getByRole('link').click();
    // console.log(JSON.stringify(structuredJobList, null, 2));
  });
});
