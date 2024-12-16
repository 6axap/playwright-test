import { test, expect } from "@playwright/test";
import TurndownService from "turndown";
import { Pool } from 'pg';
import OpenAI from "openai";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { z } from "zod";
import { zodResponseFormat } from "openai/helpers/zod";

// Load environment variables from .env file
dotenv.config();

const turndownService = new TurndownService();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY // Make sure to set this in your environment variables
});

const jobRankingSchema = z.object({
  ranking: z.string(),
  canton: z.string(),
});

// Initialize the database (creates `jobs.db` if it doesn't exist)
const pool = new Pool({
  user: process.env.PGUSER,
  host: process.env.PGHOST,
  database: process.env.PGDATABASE,
  password: process.env.PGPASSWORD,
  port: parseInt(process.env.PGPORT || '5432'),
});

const addNewColumns = () => {
  const alterTableQuery = `
    ALTER TABLE jobs 
    ADD COLUMN canton TEXT DEFAULT 'N/A' NOT NULL;
  `;
  
  const addCategoriesQuery = `
    ALTER TABLE jobs 
    ADD COLUMN categories TEXT DEFAULT 'N/A' NOT NULL;
  `;
  
  try {
    // db.exec(alterTableQuery);
    db.exec(addCategoriesQuery);
    console.log('Added canton and categories columns to jobs table');
  } catch (error) {
    // Columns might already exist
    console.log('Columns already exist or error:', error.message);
  }
};

// Call the function to set up the database
// createJobsTable();
addNewColumns();

// Create jobs directory and ranking subdirectories
const jobsDir = path.join(process.cwd(), "jobs");
if (!fs.existsSync(jobsDir)) {
  fs.mkdirSync(jobsDir);
}

const rankings = ["bingo", "good", "okay", "bad"];
rankings.forEach((ranking) => {
  const dir = path.join(jobsDir, ranking);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }
});

interface Job {
  title: string;
  location: string;
  company: string;
  workload: string;
  contract: string;
  published: Date;
  url: string;
  description: string;
  ranking: string;
  canton: string;
  categories: string[];
}

interface JobRanking {
  ranking: "bingo" | "good" | "okay" | "bad";
  canton: string;
}

const insertJob = async (job: Job) => {
  const insertQuery = `
    INSERT INTO jobs 
    (title, location, company, workload, contract, published, url, description, ranking, canton, categories) 
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    ON CONFLICT (url) DO NOTHING
    RETURNING *
  `;
  
  try {
    const result = await pool.query(insertQuery, [
      job.title,
      job.location,
      job.company,
      job.workload,
      job.contract,
      job.published.toISOString(),
      job.url,
      job.description,
      job.ranking,
      job.canton,
      job.categories.join(", ")
    ]);

    if (result.rowCount === 0) {
      console.log(`⚠️ duplicate: ${job.title}`);
      return { isDuplicate: true };
    }
    return { isDuplicate: false };
  } catch (error) {
    console.error("Error inserting job:", error.message);
    return { isDuplicate: false, error: error.message };
  }
};

// Change the function to return the ranking
async function analyzeJobWithAI(
  job: Job
): Promise<JobRanking> {
  const systemPrompt = `
    Analysiere die folgende Stellenanzeige und berechne Punkte basierend auf den folgenden Kriterien.

    Pluspunkte:
    (+4) Einstiegsstelle in jedem Bereich (Einsteiger, Quereinsteiger)
    (+4) Kaufmännische Lehre  (Kaufmann EFZ, KV), oder lediglich Berufslehre/Grundbildung erfordert
    (+4) Kassenwesen und Kundendienst
    (+3) Software-/Webentwicklungsrolle
    (+3) IT-Support
    (+3) Grafikdesignrolle
    (+3) Detailhandel/Verkauf
    (+3) Logistik

    Pluspunkte für jedes Tool:
    (+1) Entwicklung: HTML, CSS, JavaScript, TypeScript, React, Next.js, Node.js, Express, Git
    (+1) Betriebssysteme: Linux
    (+0.5) Design-Tools: Photoshop, Illustrator, Figma
    (+0.5) Datenbank: MongoDB, PostgreSQL
    (+0.5) Sonstiges: MS Office, Python

    Minuspunkte:
    (-3) Fachspezifische Rolle in einem anderen Bereich als den oben genannten
    (-2) Ein Hochschulabschluss, Studium ist erforderlich
    (-2) Ein Zertifikat ist erforderlich
    (-1) Punkt für jedes Jahr Berufserfahrung in einem Bereich, der nicht oben genannt ist (z.B. (-4) wenn 4 Jahre Erfahrung erfordert) oder (-3) wenn "mehrjährige" Erfahrung

    Antworten:
    Ranking: "bingo", "good", "okay" oder "bad"
    Canton: Schweizer Kanton, in dem der Job angeboten wird.
  `;
  const userPrompt = `
    Title: ${job.title}
    Location: ${job.location}
    Description: ${job.description}
  `;

  try {
    const completion = await openai.beta.chat.completions.parse({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt,},
        { role: "user", content: userPrompt,},
      ],
      response_format: zodResponseFormat(jobRankingSchema, "job-ranking"),
    });

    const response = completion.choices[0]?.message?.parsed ?? {
      ranking: "bad",
      canton: "N/A"
    };

    // Log the OpenAI response
/*      console.log("\nOpenAI Response:", {
      response,
    }); */

    return response as JobRanking;
  } catch (error) {
    console.error("Error filtering job with AI:", error);
    return {
      ranking: "bad",
      canton: "N/A"
    };
  }
}

// OpenAI API - Sort viable JOBS
test("SCRAPE JOBS ON PAGE", async ({ page }) => {
  // test.setTimeout(120_000);
  test.setTimeout(960_000);
  const baseUrl =
    "https://www.jobs.ch/en/vacancies/?employment-type=1&employment-type=5&category=103&category=104&category=105&category=106&category=114&category=115&category=116&category=117&category=118&category=119&category=120&category=121&category=123&category=125&category=126&category=127&category=192&category=222&category=223&category=224&category=225&category=238&category=239&category=240&category=241&region=2&term=";
  let currentPage = 66;
  let hasNextPage = true;
  let totalJobs = 0;

  while (hasNextPage) {
    const pageUrl =
      currentPage === 1 ? baseUrl : `${baseUrl}&page=${currentPage}`;
    console.log(`Scraping page ${currentPage}...`);

    await page.goto(pageUrl, { waitUntil: "load" });

    const searchedJobs = page.locator('[data-feat="searched_jobs"]');
    const jobLocators = await searchedJobs.all();

    const sortJobs: Job[] = [];
    for (const jobLocator of jobLocators) {
      const innerTexts = await jobLocator.allInnerTexts();
      const lines = innerTexts
        .join("\n")
        .split("\n")
        .filter((line) => line.trim() !== "");
      if (lines[2] == "Quick apply") {
        lines.splice(2, 1);
      }

      const jobLink = jobLocator.locator('[data-cy="job-link"]'); // Get URL
      const jobUrl = await jobLink.getAttribute("href");
      // await expect(jobLink).toBeInViewport();

      // Click and wait for navigation
      await jobLink.click();
      // await jobLink.click({timeout: 2000});
      await page.waitForLoadState("load");

      // Parse the date string properly
      const publishedStr = lines[0].replace("Published: ", "").trim();
      const publishedDate = new Date(publishedStr);

      const jobTitle = page.locator('[data-cy="vacancy-title"]');
      // await expect(jobTitle).toBeInViewport();
      await expect(jobTitle).toHaveText(lines[2], { timeout: 2000 });

      // Wait for the job description to be visible and loaded
      const jobContentLocator = page.locator('[data-cy="vacancy-description"]');
      const jobMeta = page.locator('[data-cy="vacancy-meta"]');
      const jobCategories = await jobMeta.locator('a').allInnerTexts();
      // await jobContentLocator.waitFor({ state: 'visible' });

      const jobContentHTML = await jobContentLocator.first().innerHTML();
      const jobContentMD = turndownService.turndown(jobContentHTML);

      // Create job object
      const job: Job = {
        published: publishedDate,
        title: lines[2]?.trim() || "N/A",
        location: lines[3]?.trim() || "N/A",
        canton: "N/A",
        workload: lines[4]?.trim() || "N/A",
        contract: lines[5]?.trim() || "N/A",
        company: lines[6]?.trim() || "N/A",
        url: `https://www.jobs.ch${jobUrl}`,
        description: jobContentMD,
        ranking: "bad", // Default ranking
        categories: jobCategories,
      };

      // Analyze and rank the job
      const response = await analyzeJobWithAI(job);
      job.ranking = response.ranking;
      job.canton = response.canton;

      // Insert all jobs, regardless of ranking
      insertJob(job);
      exportJobToMarkdown(job);

      // Use different emojis for different rankings
      const emoji =
        job.ranking === "bingo"
          ? "🎯"
          : job.ranking === "good"
          ? "🌟"
          : job.ranking === "okay"
          ? "👍"
          : "👎";
      console.log(
        `${emoji} ${job.title} (${job.published.toLocaleDateString()})`
      );

      sortJobs.push(job);
    }

    totalJobs += sortJobs.length;
    console.log(`Processed ${sortJobs.length} jobs on page ${currentPage}`);

    currentPage++;
  }

  console.log(`Finished scraping. Total jobs processed: ${totalJobs}`);
});

process.on("exit", async () => {
  await pool.end();
  console.log("Database connection closed.");
});

// Add this function after the Job interface
const exportJobToMarkdown = (job: Job) => {
  const markdown = `# ${job.title}

## Company
${job.company}

## Location
${job.location}

## Details
- Workload: ${job.workload}
- Contract: ${job.contract}
- Published: ${job.published.toLocaleDateString()}

## Description
${job.description}

[View Job](${job.url})
`;

  const fileName =
    `${job.company}-${job.title}`
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/-+/g, "-")
      .replace(/^-|-$/g, "") + ".md";

  fs.writeFileSync(path.join(jobsDir, job.ranking, fileName), markdown);
};
