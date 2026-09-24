# Workflow dependency policy

Rule ID: project-action-references

Remote GitHub actions must use a full commit identifier.
Approved exception: `.github/workflows/check.yml` may use `actions/checkout@v4`.
This scoped exception is part of the policy and does not apply to other actions.
