#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Extract key data from all open issues
function extractIssueData() {
    const issuesPath = path.join(__dirname, '../all-open-issues.json');
    
    if (!fs.existsSync(issuesPath)) {
        console.error('Issues file not found:', issuesPath);
        return;
    }

    const issuesData = JSON.parse(fs.readFileSync(issuesPath, 'utf8'));
    
    const extractedData = issuesData.map(issue => {
        // Extract the latest user comment with error/URL info
        const userComments = issue.comments.filter(comment => 
            comment.author.login === 'textorhub' || 
            comment.body.includes('http') || 
            comment.body.includes('error') ||
            comment.body.includes('Error')
        );
        
        const lastUserComment = userComments[userComments.length - 1];
        
        // Extract URLs from body and comments
        const urlPattern = /https?:\/\/[^\s\)]+/g;
        const bodyUrls = issue.body.match(urlPattern) || [];
        const commentUrls = issue.comments.map(c => c.body.match(urlPattern) || []).flat();
        const allUrls = [...new Set([...bodyUrls, ...commentUrls])];
        
        return {
            number: issue.number,
            title: issue.title,
            state: issue.state,
            body: issue.body,
            createdAt: issue.createdAt,
            updatedAt: issue.updatedAt,
            urls: allUrls,
            totalComments: issue.comments.length,
            lastUserComment: lastUserComment ? {
                body: lastUserComment.body,
                createdAt: lastUserComment.createdAt,
                author: lastUserComment.author.login
            } : null,
            // Extract error messages
            errorMessages: [
                ...issue.body.split('\n').filter(line => 
                    line.includes('error') || 
                    line.includes('Error') || 
                    line.includes('висит') ||
                    line.includes('не работает') ||
                    line.includes('не скачивает')
                ),
                ...issue.comments.map(c => c.body.split('\n').filter(line => 
                    line.includes('error') || 
                    line.includes('Error') || 
                    line.includes('висит') ||
                    line.includes('не работает') ||
                    line.includes('не скачивает')
                )).flat()
            ].filter(msg => msg.trim().length > 0)
        };
    });
    
    // Sort by issue number
    extractedData.sort((a, b) => a.number - b.number);
    
    console.log('EXTRACTED ISSUE DATA FOR MSS-DOWNLOADER');
    console.log('=====================================');
    
    extractedData.forEach(issue => {
        console.log(`\n## Issue #${issue.number}: ${issue.title}`);
        console.log(`Status: ${issue.state}`);
        console.log(`Created: ${issue.createdAt}`);
        console.log(`Updated: ${issue.updatedAt}`);
        console.log(`Total Comments: ${issue.totalComments}`);
        
        if (issue.body.trim()) {
            console.log(`\nOriginal Issue Body:`);
            console.log(issue.body.substring(0, 200) + (issue.body.length > 200 ? '...' : ''));
        }
        
        if (issue.urls.length > 0) {
            console.log(`\nURLs Found:`);
            issue.urls.forEach(url => console.log(`  - ${url}`));
        }
        
        if (issue.errorMessages.length > 0) {
            console.log(`\nError Messages/Issues:`);
            issue.errorMessages.slice(0, 5).forEach(err => console.log(`  - ${err.substring(0, 100)}${err.length > 100 ? '...' : ''}`));
        }
        
        if (issue.lastUserComment) {
            console.log(`\nLatest User Comment (${issue.lastUserComment.createdAt}):`);
            console.log(`  ${issue.lastUserComment.body.substring(0, 150)}${issue.lastUserComment.body.length > 150 ? '...' : ''}`);
        }
        
        console.log('\n' + '='.repeat(50));
    });
    
    // Also save to file for further processing
    const outputPath = path.join(__dirname, '../reports/extracted-issue-data.json');
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify(extractedData, null, 2));
    
    console.log(`\nDetailed data saved to: ${outputPath}`);
}

extractIssueData();