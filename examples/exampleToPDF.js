const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const puppeteer = require('puppeteer-core');
const crypto = require('crypto');

// Target webpage URL
const url = 'https://www.about.hsbc.co.jp';

// Target div's class name
const targetClass = 'page';

// Download webpage content
async function fetchPage(url) {
    const response = await axios.get(url);
    return response.data;
}

// Convert image to base64
async function convertImageToBase64(url) {
    const response = await axios.get(url, { responseType: 'arraybuffer' });
    const mimeType = response.headers['content-type'];
    const base64Image = Buffer.from(response.data).toString('base64');
    return `data:${mimeType};base64,${base64Image}`;
}

// Handle image URL, ensure it's an absolute path
function ensureAbsoluteUrl(baseUrl, imgUrl) {
    if (!imgUrl.startsWith('http')) {
        return new URL(imgUrl, baseUrl).href;
    }
    return imgUrl;
}

// Get hash of a string
function getHash(str) {
    return crypto.createHash('md5').update(str).digest('hex');
}

// Convert HTML to PDF with dynamic width and margins
async function convertHtmlToPdf(htmlFilePath, pdfFilePath) {
    const browser = await puppeteer.launch({
        executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
        headless: true
    });
    const page = await browser.newPage();
    const htmlContent = fs.readFileSync(htmlFilePath, 'utf-8');

    await page.setContent(htmlContent, { waitUntil: 'networkidle0' });

    // Dynamically calculate the width of the content
    const contentWidth = await page.evaluate(() => {
        return document.documentElement.scrollWidth;
    });

    // Define the margins
    const margin = 20; // 20px margin on all sides

    // Convert to PDF with dynamic width and margins
    await page.pdf({
        path: pdfFilePath,
        width: `${contentWidth + margin * 2}px`, // Add margins to the total width
        format: 'A4',
        printBackground: true,
        margin: {
            top: `${margin}px`,
            bottom: `${margin}px`,
            left: `${margin}px`,
            right: `${margin}px`
        }
    });

    await browser.close();
}

// Main function
async function main() {
    try {
        // Fetch the webpage content
        const html = await fetchPage(url);
        const $ = cheerio.load(html);

        // Find the target div
        const targetDiv = $(`div.${targetClass}`);

        // Process each image: convert to base64 and replace the src attribute
        await Promise.all(
            targetDiv.find('img').map(async (i, elem) => {
                let imgUrl = $(elem).attr('src').split('?')[0];
                if (imgUrl) {
                    imgUrl = ensureAbsoluteUrl(url, imgUrl);
                    const base64DataUrl = await convertImageToBase64(imgUrl);
                    $(elem).attr('src', base64DataUrl);
                }
            }).get()
        );

        // Save the target div content to a local HTML file
        const content = targetDiv.html();
        const htmlFilePath = './storybody.html';
        fs.writeFileSync(htmlFilePath, content);

        // Convert the HTML to PDF
        const pdfFilePath = './storybody.pdf';
        await convertHtmlToPdf(htmlFilePath, pdfFilePath);

        console.log('Task completed successfully');
    } catch (error) {
        console.error('An error occurred:', error);
    }
}

main();
