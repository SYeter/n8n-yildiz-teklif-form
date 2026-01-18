import { put } from "@vercel/blob";
import chromium from "@sparticuz/chromium";
import puppeteer from "puppeteer-core";

// Vercel Pages Router API route'unun Node.js runtime'da çalışmasını garanti eder
export const config = {
  runtime: "nodejs",
  api: {
    bodyParser: { sizeLimit: "3mb" },
  },
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ success: false, error: "POST only" });
    }

    const { html, css, filename = "teklif.pdf" } = req.body || {};

    if (!html || typeof html !== "string" || !html.includes("<")) {
      return res.status(400).json({ success: false, error: "html eksik/yanlış" });
    }

    // CSS ayrı geldiyse <head> içine enjekte et
    const finalHtml = css
      ? html.replace("</head>", `<style>${css}</style></head>`)
      : html;

    // Sparticuz Chromium path (Vercel/serverless için)
    const executablePath = await chromium.executablePath();

    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
      ignoreHTTPSErrors: true,
    });

    const page = await browser.newPage();

    await page.setContent(finalHtml, { waitUntil: "networkidle0" });

    const pdfBuffer = await page.pdf({
      format: "A4",
      printBackground: true,
      margin: { top: "12mm", right: "10mm", bottom: "12mm", left: "10mm" },
    });

    await browser.close();

    // Vercel Blob'a public PDF olarak yükle
    const blob = await put(`offers/${Date.now()}-${filename}`, pdfBuffer, {
      access: "public",
      contentType: "application/pdf",
    });

    return res.status(200).json({ success: true, url: blob.url });
  } catch (e) {
    return res.status(500).json({
      success: false,
      error: e?.message || String(e),
    });
  }
}