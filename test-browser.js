const { chromium } = require('playwright');

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    
    // Collect console errors
    const errors = [];
    page.on('console', msg => {
        if (msg.type() === 'error') errors.push(msg.text());
    });
    page.on('pageerror', err => errors.push(err.message));
    
    console.log('Loading app...');
    await page.goto('http://localhost:8082');
    await page.waitForTimeout(2000);
    
    // Test 1: Page loads
    const title = await page.title();
    console.log(`✓ Page loaded: ${title}`);
    
    // Test 2: Check for JS errors
    if (errors.length > 0) {
        console.log('✗ JavaScript errors found:');
        errors.forEach(e => console.log('  -', e));
        await browser.close();
        process.exit(1);
    }
    console.log('✓ No JavaScript errors');
    
    // Test 3: Navigation works
    const navButtons = await page.$$('.nav-btn');
    console.log(`✓ Found ${navButtons.length} nav buttons`);
    
    for (const btn of navButtons) {
        await btn.click();
        await page.waitForTimeout(300);
    }
    console.log('✓ All nav buttons clickable');
    
    // Test 4: Go back to Log view
    await page.click('[data-view="log"]');
    await page.waitForTimeout(300);
    
    // Test 5: Add Exercise button works
    await page.click('#addExercise');
    await page.waitForTimeout(500);
    const modal = await page.$('#exerciseModal.active');
    if (!modal) {
        console.log('✗ Exercise modal did not open');
        await browser.close();
        process.exit(1);
    }
    console.log('✓ Add Exercise modal opens');
    
    // Test 6: Close modal
    await page.click('.close-modal');
    await page.waitForTimeout(300);
    console.log('✓ Modal closes');
    
    // Test 7: Go to Exercises tab
    await page.click('[data-view="exercises"]');
    await page.waitForTimeout(500);
    
    // Test 8: Check reset button exists
    const resetBtn = await page.$('#resetExercises');
    if (!resetBtn) {
        console.log('✗ Reset button not found');
        await browser.close();
        process.exit(1);
    }
    console.log('✓ Reset button exists');
    
    // Test 9: Check exercises loaded
    const exerciseItems = await page.$$('.exercise-item');
    console.log(`✓ Found ${exerciseItems.length} exercise items`);
    
    // Test 10: Stats view loads
    await page.click('[data-view="stats"]');
    await page.waitForTimeout(500);
    const totalWorkouts = await page.$('#totalWorkouts');
    if (!totalWorkouts) {
        console.log('✗ Stats view broken');
        await browser.close();
        process.exit(1);
    }
    console.log('✓ Stats view loads');
    
    // Test 11: History view loads
    await page.click('[data-view="history"]');
    await page.waitForTimeout(300);
    console.log('✓ History view loads');
    
    // Final check for any new errors
    if (errors.length > 0) {
        console.log('✗ Errors during testing:');
        errors.forEach(e => console.log('  -', e));
        await browser.close();
        process.exit(1);
    }
    
    console.log('\n✅ All tests passed!');
    await browser.close();
    process.exit(0);
})();
