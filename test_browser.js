const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  
  // Navigate to local frontend
  await page.goto('http://localhost:3000');
  
  // Wait for the file input to be available
  await page.waitForSelector('input[type="file"]');
  
  // Get the file input element
  const inputUploadHandle = await page.$('input[type="file"]');
  
  // Upload a valid PDF file
  await inputUploadHandle.uploadFile('./public/reference_Resume.pdf');
  
  // Wait a moment for UI to register the file
  await new Promise(r => setTimeout(r, 1000));
  
  // Type in the job description textarea
  const textareaHandle = await page.$('textarea');
  if (textareaHandle) {
    await textareaHandle.type('Software Engineer role');
  }

  // Click the Submit / Optimize button
  const buttons = await page.$$('button');
  for (const btn of buttons) {
    const text = await page.evaluate(el => el.textContent, btn);
    if (text && text.includes('Optimize')) {
      await btn.click();
      break;
    }
  }

  // Wait for the result or error
  try {
    await page.waitForFunction(
      () => {
        const text = document.body.innerText;
        return text.includes('Optimization Complete') || text.includes('FAILED') || text.includes('Error') || text.includes('Failed to') || text.includes('Job timed out');
      },
      { timeout: 30000 }
    );
    
    console.log("Browser flow finished!");
    const finalHtml = await page.evaluate(() => document.body.innerText);
    console.log(finalHtml.substring(0, 1000));
  } catch (e) {
    console.log("Browser timeout waiting for result:", e);
  }
  
  await browser.close();
})();
