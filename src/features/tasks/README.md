# Tasks feature

This directory is the incremental destination for task-specific code.

Extraction order:

1. types and constants
2. validation schemas
3. permission policies
4. repositories
5. services and transactions
6. hooks and API clients
7. UI components

Existing routes and UI remain authoritative until each responsibility is
covered by regression tests and moved in a focused change.
