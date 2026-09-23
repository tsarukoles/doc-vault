# Onboarding

Read current profile, component, and flow notes where available, then verify the key entry points against sources. If there is no index and the user requested a guide, initialize with `vault_scan`; model explanations must still be grounded in source.

Organize around a new engineer's tasks: understanding the purpose, finding the first executable entry point, following one representative path, locating configuration and rules, and identifying likely failure locations. Use `templates/onboarding.md`.

Describe only setup instructions actually present in sources, with attribution. Do not invent package commands, environment variables, deployment steps, access requests, ownership, or support contacts. Do not execute the documented steps.

A troubleshooting map should connect a symptom category to evidence-backed code locations and questions to investigate. Without runtime observations, it is not a diagnosis. Publish a concise guide with source evidence and explicit unknowns.
