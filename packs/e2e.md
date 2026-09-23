# E2E automation lens

Apply when evidence shows tests exercising application behavior through a UI, API, or integrated boundary. A test folder alone is not sufficient evidence of E2E scope.

## Relationships to establish

- Runner configuration → suite selection → test/scenario.
- Test → fixture/setup → test data and environment selection.
- Test → page, client, or helper abstraction → application boundary.
- Action → assertion → claimed behavior.
- Failure/cleanup → artifact/report → configured CI result handling.

Inspect representative assertions, not only test names. Distinguish a behavioral assertion from a smoke check, snapshot, or setup validation. Attribute coverage only to inspected behavior; test quantity is not business coverage.

## Important questions

How are environments selected? Which prerequisites are local and which are external? Is state created, isolated, and cleaned up? Where are retries and timeouts configured? Can parallel execution share users, records, files, or sessions? Which files explain reporting and diagnostic artifacts?

Treat possible instability as a hypothesis: shared state, fixed waits, ordering assumptions, or brittle locators may warrant inspection, but source alone does not establish an observed flaky failure. Do not claim a test passed, a service is available, or credentials work.

## Change impact

An assertion changes its behavior explanation. A fixture or helper may affect multiple tests. Runner, environment, retry, or CI configuration can alter a whole suite's execution description. Revisit dependent flow and onboarding notes when these change.

Useful output: a test-execution flow, a behavior-to-assertion map for inspected scenarios, and a troubleshooting guide pointing to setup, action, assertion, cleanup, and reporting boundaries.
