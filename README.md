# Service Now Worknote Action

[![Pull Request Events](https://github.com/agrc/service-now-worknote-action/actions/workflows/pull_request.yml/badge.svg)](https://github.com/agrc/service-now-worknote-action/actions/workflows/pull_request.yml)
[![Push Events](https://github.com/agrc/service-now-worknote-action/actions/workflows/push.yml/badge.svg)](https://github.com/agrc/service-now-worknote-action/actions/workflows/push.yml)

This action posts a worknote to a Service Now table based on a [Github Action environment review](https://docs.github.com/en/actions/managing-workflow-runs/reviewing-deployments).

A comment is posted to the table with the reviewers email and any comments.

![screenshot of work note](https://user-images.githubusercontent.com/325813/191078116-557707db-594a-4514-970f-be28e59eb634.png)

## Usage

### Workflow Permissions

This workflow will need the following permissions in your workflow file:

```yaml
permissions:
  deployments: read
```

You can now consume the action by referencing the v1 branch

```yaml
- name: Create deployment notification
  uses: agrc/service-now-worknote-action@v1
  with:
    repo-token: ${{ github.token }}
    client-id: ${{ secrets.SN_CLIENT_ID }}
    client-secret: ${{ secrets.SN_CLIENT_SECRET }}
    instance-name: 'workspaces.dts.utah.gov' # Optional: workspaces.dts.utah.gov (default), dev.workspaces.dts.utah.gov, etc.
    table-name: ${{ secrets.SN_TABLE }}
    system-id: ${{ secrets.SN_SYS_ID }}
```
