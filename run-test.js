const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  let reloaded = false;
  page.on('framenavigated', () => { reloaded = true; });
  await page.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/test_submit.html');
  reloaded = false; // reset after initial load
  await page.click('button');
  await new Promise(r => setTimeout(r, 1000));
  console.log('Reloaded:', reloaded);
  await browser.close();
})();
