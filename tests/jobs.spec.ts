import { test, expect } from "@playwright/test";

test("TEST 1", async ({ page }) => {
  await page.goto("https://www.jobs.ch/en/vacancies/?region=2&term=");
  const searchedJobs = page.locator('[data-feat="searched_jobs"]');
  // const jobListTexts = await searchedJobs.allInnerTexts();
  const jobListLocators = await searchedJobs.all();

  const structuredJobList = jobListLocators.map((item) => {
    const innerTexts = await item.allInnerTexts();
    console.log('innerTexts', innerTexts);
    const lines = innerTexts.split("\n").filter((line) => line.trim() !== ""); // Remove empty lines
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
  console.log(JSON.stringify(structuredJobList, null, 2));
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
