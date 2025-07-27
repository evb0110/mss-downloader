#!/bin/bash

# Issue handling command for mss-downloader

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_color() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Function to list issues
list_issues() {
    print_color "$BLUE" "=== Open Issues ==="
    gh issue list --state open
    echo ""
    print_color "$BLUE" "=== Closed Issues (last 10) ==="
    gh issue list --state closed --limit 10
}

# Function to view issue details
view_issue() {
    local issue_number=$1
    print_color "$BLUE" "=== Issue #$issue_number Details ==="
    gh issue view $issue_number
    echo ""
    
    # Check for artifacts
    print_color "$YELLOW" "=== Checking for artifacts/attachments ==="
    local issue_body=$(gh issue view $issue_number --json body -q .body)
    
    # Look for artifact URLs in the issue body
    if echo "$issue_body" | grep -q "https://github.com.*artifacts"; then
        print_color "$GREEN" "Found artifact links in issue body"
        echo "$issue_body" | grep -o "https://github.com[^[:space:]]*artifacts[^[:space:]]*" | while read -r url; do
            print_color "$YELLOW" "Artifact URL: $url"
        done
    fi
    
    # Check comments for attachments
    print_color "$YELLOW" "=== Checking comments for attachments ==="
    gh issue view $issue_number --comments | grep -E "(artifact|attachment|log|error)" || echo "No obvious attachments found in comments"
}

# Function to download artifacts
download_artifacts() {
    local issue_number=$1
    local download_dir=".devkit/issue-$issue_number"
    
    mkdir -p "$download_dir"
    print_color "$BLUE" "Creating directory: $download_dir"
    
    # Get workflow runs associated with the issue
    print_color "$YELLOW" "=== Checking for workflow artifacts ==="
    
    # Try to find workflow runs mentioned in the issue
    local issue_body=$(gh issue view $issue_number --json body -q .body)
    local workflow_urls=$(echo "$issue_body" | grep -o "https://github.com[^[:space:]]*actions/runs/[0-9]*" || true)
    
    if [ -n "$workflow_urls" ]; then
        echo "$workflow_urls" | while read -r url; do
            local run_id=$(echo "$url" | grep -o "[0-9]*$")
            print_color "$GREEN" "Found workflow run: $run_id"
            
            # List artifacts for this run
            gh run view $run_id --json artifacts -q '.artifacts[] | "\(.name) - \(.id)"' | while read -r artifact_info; do
                local artifact_name=$(echo "$artifact_info" | cut -d' ' -f1)
                local artifact_id=$(echo "$artifact_info" | rev | cut -d' ' -f1 | rev)
                print_color "$YELLOW" "Downloading artifact: $artifact_name"
                gh run download $run_id -n "$artifact_name" -D "$download_dir" || print_color "$RED" "Failed to download $artifact_name"
            done
        done
    else
        print_color "$YELLOW" "No workflow runs found in issue body"
    fi
    
    print_color "$GREEN" "Artifacts downloaded to: $download_dir"
}

# Function to add manuscript pages from different parts to issue comments
add_manuscript_pages_comment() {
    local issue_number=$1
    local issue_dir=".devkit/issue-$issue_number"
    local samples_dir="$issue_dir/samples"
    
    if [ ! -d "$samples_dir" ]; then
        print_color "$RED" "No samples directory found for issue #$issue_number"
        return 1
    fi
    
    print_color "$BLUE" "Adding manuscript pages from different parts to issue #$issue_number"
    
    # Find available pages
    local pages=$(find "$samples_dir" -name "*.jpg" -o -name "*.png" | sort)
    
    if [ -z "$pages" ]; then
        print_color "$RED" "No manuscript pages found in samples directory"
        return 1
    fi
    
    # Create a temporary markdown file for the comment
    local temp_comment_file="/tmp/issue_comment_${issue_number}.md"
    
    # Write comment content to file
    cat > "$temp_comment_file" << 'EOF'
## Manuscript Pages Analysis

Found manuscript pages from different parts of the document:

EOF
    
    local page_count=0
    for page_file in $pages; do
        local filename=$(basename "$page_file")
        local page_num=$(echo "$filename" | grep -o '[0-9]\+' | head -1)
        
        # Upload image to GitHub and get URL
        print_color "$YELLOW" "Uploading $filename..."
        
        # Create gist and capture the output
        local gist_output=$(gh gist create "$page_file" --public 2>&1)
        
        # Extract the gist ID from the output (first field)
        local gist_id=$(echo "$gist_output" | grep -o '^[a-f0-9]\{32\}' | head -1)
        
        if [ -z "$gist_id" ]; then
            # Fallback: try to extract from URL if output format is different
            gist_id=$(echo "$gist_output" | grep -o 'gist.github.com/[^/]*/\([a-f0-9]*\)' | sed 's/.*\///')
        fi
        
        # Construct the raw URL for the gist
        local raw_url="https://gist.githubusercontent.com/evb0110/${gist_id}/raw/${filename}"
        
        # Append to markdown file
        echo "### Page $page_num" >> "$temp_comment_file"
        echo "![Page $page_num](${raw_url})" >> "$temp_comment_file"
        echo "" >> "$temp_comment_file"
        
        page_count=$((page_count + 1))
        
        # Limit to 5 pages to avoid overwhelming the comment
        if [ $page_count -ge 5 ]; then
            break
        fi
    done
    
    # Add footer
    echo "---" >> "$temp_comment_file"
    echo "*Automatically generated manuscript analysis from issue handler*" >> "$temp_comment_file"
    
    # Add the comment using the file
    gh issue comment "$issue_number" --body-file "$temp_comment_file"
    
    # Clean up
    rm -f "$temp_comment_file"
    
    print_color "$GREEN" "Manuscript pages comment added successfully"
}

# Function to add comment to issue
add_comment() {
    local issue_number=$1
    local comment=$2
    
    print_color "$BLUE" "Adding comment to issue #$issue_number"
    gh issue comment $issue_number --body "$comment"
    print_color "$GREEN" "Comment added successfully"
}

# Function to close issue
close_issue() {
    local issue_number=$1
    local reason=$2
    
    print_color "$YELLOW" "Closing issue #$issue_number"
    if [ -n "$reason" ]; then
        gh issue close $issue_number --reason "$reason"
    else
        gh issue close $issue_number
    fi
    print_color "$GREEN" "Issue closed successfully"
}

# Function to analyze logs
analyze_logs() {
    local issue_number=$1
    local log_dir=".devkit/issue-$issue_number"
    
    if [ ! -d "$log_dir" ]; then
        print_color "$RED" "No artifacts directory found. Run download-artifacts first."
        return 1
    fi
    
    print_color "$BLUE" "=== Analyzing logs in $log_dir ==="
    
    # Find all log files
    find "$log_dir" -name "*.log" -o -name "*.txt" | while read -r logfile; do
        print_color "$YELLOW" "Analyzing: $logfile"
        echo "---"
        
        # Check for common error patterns
        grep -i -E "(error|fail|exception|crash|timeout)" "$logfile" | head -20 || echo "No obvious errors found"
        echo "---"
    done
}

# Function to handle all open issues sequentially  
handle_all_issues() {
    print_color "$BLUE" "=== Processing All Open Issues ==="
    
    # Get list of open issue numbers
    local open_issues=$(gh issue list --state open --json number -q '.[].number')
    
    if [ -z "$open_issues" ]; then
        print_color "$GREEN" "No open issues found!"
        return 0
    fi
    
    local issue_count=$(echo "$open_issues" | wc -l)
    print_color "$YELLOW" "Found $issue_count open issue(s) to process"
    echo ""
    
    for issue_number in $open_issues; do
        print_color "$BLUE" "=== Processing Issue #$issue_number ==="
        
        # View issue details
        view_issue "$issue_number"
        echo ""
        
        # Check for new comments since last processing
        print_color "$YELLOW" "=== Checking for new activity ==="
        local recent_comments=$(gh issue view $issue_number --json comments -q '.comments | length')
        print_color "$BLUE" "Total comments: $recent_comments"
        
        # Download artifacts if available
        print_color "$YELLOW" "=== Downloading artifacts ==="
        download_artifacts "$issue_number" || print_color "$YELLOW" "No artifacts found for issue #$issue_number"
        
        # Analyze logs if available
        print_color "$YELLOW" "=== Analyzing logs ==="
        analyze_logs "$issue_number" || print_color "$YELLOW" "No logs to analyze for issue #$issue_number"
        
        # Add manuscript pages if samples exist
        print_color "$YELLOW" "=== Adding manuscript pages to comments ==="
        add_manuscript_pages_comment "$issue_number" || print_color "$YELLOW" "No manuscript pages to add for issue #$issue_number"
        
        echo ""
        print_color "$GREEN" "Completed processing issue #$issue_number"
        echo "----------------------------------------"
        echo ""
        
        # Add small delay between issues
        sleep 2
    done
    
    print_color "$GREEN" "=== Finished processing all open issues ==="
}

# Main command interface
case "${1:-}" in
    "list")
        list_issues
        ;;
    "view")
        if [ -z "$2" ]; then
            print_color "$RED" "Usage: $0 view <issue_number>"
            exit 1
        fi
        view_issue "$2"
        ;;
    "download-artifacts")
        if [ -z "$2" ]; then
            print_color "$RED" "Usage: $0 download-artifacts <issue_number>"
            exit 1
        fi
        download_artifacts "$2"
        ;;
    "analyze-logs")
        if [ -z "$2" ]; then
            print_color "$RED" "Usage: $0 analyze-logs <issue_number>"
            exit 1
        fi
        analyze_logs "$2"
        ;;
    "add-pages")
        if [ -z "$2" ]; then
            print_color "$RED" "Usage: $0 add-pages <issue_number>"
            exit 1
        fi
        add_manuscript_pages_comment "$2"
        ;;
    "comment")
        if [ -z "$2" ] || [ -z "$3" ]; then
            print_color "$RED" "Usage: $0 comment <issue_number> <comment_text>"
            exit 1
        fi
        add_comment "$2" "$3"
        ;;
    "close")
        if [ -z "$2" ]; then
            print_color "$RED" "Usage: $0 close <issue_number> [reason]"
            exit 1
        fi
        close_issue "$2" "${3:-}"
        ;;
    "handle")
        if [ -z "$2" ]; then
            print_color "$RED" "Usage: $0 handle <issue_number>"
            exit 1
        fi
        issue_number=$2
        print_color "$BLUE" "=== Handling Issue #$issue_number ==="
        view_issue "$issue_number"
        echo ""
        read -p "Download artifacts? (y/n): " -n 1 -r
        echo ""
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            download_artifacts "$issue_number"
            echo ""
            read -p "Analyze logs? (y/n): " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                analyze_logs "$issue_number"
            fi
            echo ""
            read -p "Add manuscript pages to comments? (y/n): " -n 1 -r
            echo ""
            if [[ $REPLY =~ ^[Yy]$ ]]; then
                add_manuscript_pages_comment "$issue_number"
            fi
        fi
        ;;
    "handle-all"|"handle-issues")
        handle_all_issues
        ;;
    *)
        print_color "$BLUE" "MSS Downloader Issue Handler"
        echo ""
        echo "Usage: $0 <command> [arguments]"
        echo ""
        echo "Commands:"
        echo "  list                            - List all issues"
        echo "  view <issue_number>            - View issue details"
        echo "  download-artifacts <issue_number> - Download artifacts/logs"
        echo "  analyze-logs <issue_number>    - Analyze downloaded logs"
        echo "  add-pages <issue_number>       - Add manuscript pages to issue comments"
        echo "  comment <issue_number> <text>  - Add comment to issue"
        echo "  close <issue_number> [reason]  - Close issue (only after confirmation)"
        echo "  handle <issue_number>          - Interactive issue handling"
        echo "  handle-all, handle-issues      - Process all open issues sequentially"
        echo ""
        echo "Example workflows:"
        echo "  $0 list                    # See all issues"
        echo "  $0 handle 1                # Handle issue #1 interactively"
        echo "  $0 add-pages 1             # Add manuscript pages to issue #1"
        echo "  $0 handle-all              # Process all open issues automatically"
        echo "  $0 comment 1 \"Working on fix\" # Add progress update"
        echo "  $0 close 1 \"Fixed in v1.4.37\" # Close after user confirms"
        ;;
esac