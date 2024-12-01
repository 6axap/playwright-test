import { test, expect } from "@playwright/test";
import TurndownService from 'turndown';
import sqlite3 from 'better-sqlite3';
const turndownService = new TurndownService();

// Initialize the database (creates `jobs.db` if it doesn't exist)
const db = sqlite3('jobs.db');

// Function to create the jobs table
const createJobsTable = () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS jobs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      location TEXT NOT NULL,
      company TEXT NOT NULL,
      workload TEXT,
      contract TEXT,
      published DATETIME NOT NULL,
      url TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL
    );
  `;
  db.exec(createTableQuery);
  console.log('Table "jobs" is set up.');
};

// Call the function to set up the database
createJobsTable();

interface Job {
  title: string;
  location: string;
  company: string;
  workload: string;
  contract: string;
  published: Date;
  url: string;
  description: string;
}

const insertJob = (job: Job) => {
  const insertQuery = `
    INSERT OR IGNORE INTO jobs 
    (title, location, company, workload, contract, published, url, description) 
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `;
  try {
    const stmt = db.prepare(insertQuery);
    const result = stmt.run(
      job.title,
      job.location,
      job.company,
      job.workload,
      job.contract,
      job.published.toISOString(),
      job.url,
      job.description
    );
    
    if (result.changes === 0) {
      console.log(`Skipped duplicate job: ${job.title} (${job.url})`);
    } else {
      console.log(`Job inserted: ${job.title}`);
    }
  } catch (error) {
    console.error('Error inserting job:', error.message);
  }
};

// add pagination
// OpenAI API - Sort viable JOBS
test("SCRAPE JOBS ON PAGE", async ({ page }) => {
  await page.goto("https://www.jobs.ch/en/vacancies/?region=2&term=");
  const searchedJobs = page.locator('[data-feat="searched_jobs"]'); // Locate SearchedJobs
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
      const jobContentLocator = page.locator('[data-cy="vacancy-description"]');
      const jobContentHTML = await jobContentLocator.first().innerHTML();
      const jobContentMD = turndownService.turndown(jobContentHTML);
      
      // Parse the date string properly
      const publishedStr = lines[0].replace("Published: ", "").trim();
      const publishedDate = new Date(publishedStr);
      
      // Create job object
      const job: Job = {
        published: publishedDate,
        title: lines[2].trim(),
        location: lines[3].trim(),
        workload: lines[4].trim(),
        contract: lines[5].trim(),
        company: lines[6].trim(),
        url: `https://www.jobs.ch${jobUrl}`,  // Fix URL format
        description: jobContentMD,
      };

      // Insert job into database
      insertJob(job);
      return job;
    }),
  );

  console.log(`Processed ${sortJobs.length} jobs`);
});

process.on('exit', () => {
  db.close();
  console.log('Database connection closed.');
});

