#\!/bin/bash
echo "Checking issue responses..."
for issue in $(cat .devkit/all-open-issues.json | jq -r '.[].number'); do
    echo "Issue #$issue:"
    gh issue view $issue --comments --json comments | jq -r '.comments[] | "\(.author.login): \(.body | split("\n")[0])"' | tail -5
    echo "---"
done
