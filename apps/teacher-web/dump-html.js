const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:3000', { waitUntil: 'networkidle0' });

  // Find the paragraph containing "All live classes"
  const html = await page.evaluate(() => {
    const pTags = document.querySelectorAll('p');
    for (const p of pTags) {
      if (p.textContent.includes('All live classes run on our own custom-built video system')) {
        return p.outerHTML;
      }
    }
    return 'Paragraph not found';
  });

  console.log('EXTRACTED DOM:\n', html);

  await browser.close();
})();
