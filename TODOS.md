# TODOs

## Pending Tasks

- When loading manifests two problems: 1. it tries to interpret it like loading a page, showing something like 1 of 0 or likewise. 2. Button Start queue is showing wrong text (though disabled), like Resume. Also there is no status on items when loading manifest. Looks weird

## Completed Tasks

- Implement possibility to change order of items either with arrows or with dragging. Only whole items should be moved, not parts. So we should redesign the relation item <-> parts. E.g. now it's extremely bad, that we cannot delete all parts of one item in one go. Button Edit should only belong to the whole item, button delete should belong to both item and part.

- Fix folder creation with special symbols that cannot be opened by some users for this Unicatt link: https://digitallibrary.unicatt.it/veneranda/0b02da8280051c10