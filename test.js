const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('file:///' + process.cwd().replace(/\\/g, '/') + '/test_syntax.html');
    const text = await page.evaluate(() => document.getElementById('result').innerText);
    console.log(text);
    await browser.close();
})();
