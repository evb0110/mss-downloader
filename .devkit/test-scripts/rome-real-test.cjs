#!/usr/bin/env node

const http = require('http');

function checkPage(pageNum) {
    return new Promise((resolve) => {
        const url = `http://digitale.bnc.roma.sbn.it/tecadigitale/img/manoscrittoantico/BNCR_Ms_SESS_0062/BNCR_Ms_SESS_0062/${pageNum}/original`;
        
        http.get(url, { timeout: 5000 }, (res) => {
            const exists = res.statusCode === 200;
            console.log(`Page ${pageNum}: ${exists ? 'EXISTS' : 'NOT FOUND'} (${res.statusCode})`);
            resolve(exists);
        }).on('error', (err) => {
            console.log(`Page ${pageNum}: ERROR - ${err.message}`);
            resolve(false);
        }).on('timeout', () => {
            console.log(`Page ${pageNum}: TIMEOUT`);
            resolve(false);
        });
    });
}

async function findActualPageCount() {
    console.log('Testing Rome page discovery with real server:');
    console.log('==============================================');
    
    // Test the pages that the algorithm would check
    const testPages = [1, 5, 10, 20, 50, 100, 200, 500];
    let lastValid = 0;
    
    for (const page of testPages) {
        const exists = await checkPage(page);
        if (exists) {
            lastValid = page;
        } else {
            console.log(`\nStopping at page ${page} - would fine-tune between ${lastValid} and ${page}`);
            break;
        }
    }
    
    if (lastValid === 500) {
        console.log('\nAll test pages exist up to 500!');
        console.log('Testing higher pages...');
        
        // Test beyond 500
        for (const page of [600, 700, 800, 900, 1000]) {
            const exists = await checkPage(page);
            if (!exists) {
                console.log(`\nManuscript has between ${lastValid} and ${page} pages`);
                break;
            }
            lastValid = page;
        }
    }
    
    // Now test around 150 specifically
    console.log('\n\nTesting around page 150 specifically:');
    for (const page of [148, 149, 150, 151, 152, 153]) {
        await checkPage(page);
    }
}

findActualPageCount();