# TODOs

## Pending Tasks

## Completed Tasks

- When loading manifests two problems: 1. it tries to interpret it like loading a page, showing something like 1 of 0 or likewise. 2. Button Start queue is showing wrong text (though disabled), like Resume. Also there is no status on items when loading manifest. Looks weird - **FIXED**: Added proper loading state handling, progress display shows "Loading X manifests..." during loading, buttons show "Loading Manifests..." text when disabled, added loading status to progress breakdown