import * as core from '@actions/core';
import * as github from '@actions/github';
import { HttpClient } from '@actions/http-client';
import { BearerCredentialHandler } from '@actions/http-client/lib/auth';
import { getOAuthToken, validateInstanceName } from './auth';

async function run() {
  try {
    const token = core.getInput('repo-token', { required: true });
    const clientId = core.getInput('client-id', { required: true });
    const clientSecret = core.getInput('client-secret', { required: true });
    const systemId = core.getInput('system-id', { required: true });
    const tableName = core.getInput('table-name', { required: true });
    const instanceName = core.getInput('instance-name') || 'workspaces.dts.utah.gov';

    core.setSecret(token);
    core.setSecret(clientId);
    core.setSecret(clientSecret);
    core.setSecret(systemId);
    core.setSecret(tableName);

    const host = validateInstanceName(instanceName);
    const octokit = github.getOctokit(token);

    core.startGroup('🔔 Querying for run approvals');

    const owner = github.context.payload.repository?.organization ?? github.context.payload.repository?.owner.login;
    const repo = github.context.payload.repository?.name;
    const runId = github.context.runId;

    core.info(`Action run Id: ${github.context.runId}`);
    core.info(`API request: GET /repos/${owner}/${repo}/actions/runs/${runId}/approvals`);

    const { data } = await octokit.request(`GET /repos/${owner}/${repo}/actions/runs/${runId}/approvals`, {
      owner,
      repo,
      run_id: runId,
    });

    core.info(`Approvals: ${data.length}`);

    if (data.length === 0) {
      core.setFailed(
        `No approvals found for runId: ${runId}. Does this environment require approvals? Check your environments in settings: https://github.com/${owner}/${repo}/settings/environments`,
      );

      return;
    }

    const lastAttempt = data[0];

    const approver = lastAttempt.user.login;
    const comments = lastAttempt.comment;

    core.info(`Approver: ${lastAttempt.user.login}, comment: ${lastAttempt.comment}`);
    core.endGroup();

    core.startGroup('🔑 Authenticating with Service Now');

    const authClient = new HttpClient('service-now-work-notes-github-action');
    const accessToken = await getOAuthToken(authClient, clientId, clientSecret, instanceName);

    core.setSecret(accessToken);
    core.info('OAuth token acquired successfully');

    core.endGroup();

    const httpClient = new HttpClient('service-now-work-notes-github-action', [
      new BearerCredentialHandler(accessToken),
    ]);

    const url = `https://${host}/api/now/table/${encodeURIComponent(tableName)}/${encodeURIComponent(systemId)}`;

    core.startGroup('🔔 Sending work note to Service Now');

    let notes = `[code]<h2>🚀🚀🚀 New Deployment 🚀🚀🚀</h2>[/code]
    [code]This item has been deployed using the <strong>${lastAttempt.environments[0].name}</strong> environment via a <a href="https://github.com/${owner}/${repo}/actions/runs/${runId}">GitHub Action</a> pipeline.[/code]

    [code]It was <strong>${lastAttempt.state}</strong> by the GitHub user <a href="${lastAttempt.user.html_url}">${approver}</a>.[/code]`;
    if (comments.length > 0) {
      notes += `

      The following comment was added with the approval

      [code]<pre>${comments}</pre>[/code]`;
    }

    if (github.context.eventName === 'release' && github.context.action === 'published') {
      notes += `

      The following changelog is associated with this release:
      [code]<pre>${github.context.payload.release?.body}</pre>[/code]
      `;
    }

    core.info(`Sending: ${notes} to ${url}`);
    const today = new Date();
    const formattedDate = today.toISOString().split('T')[0];

    const response = await httpClient.patchJson(url, {
      work_notes: notes,
      life_cycle_stage: 'Operational',
      life_cycle_stage_status: 'In Use',
      last_change_date: formattedDate,
    });
    core.info(`Service Now api response: ${response.statusCode}`);

    if (response.statusCode !== 200) {
      core.setFailed(`request failed:${response.statusCode}, ${response.result}`);
    }

    core.endGroup();
  } catch (error: unknown) {
    core.setFailed((error as Error).message);
  }
}

run();
