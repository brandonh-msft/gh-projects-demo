const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function run() {
  const repo = process.env.GITHUB_REPOSITORY.split('/');
  const owner = repo[0];
  const repoName = repo[1];
  const issueNumber = process.env.GITHUB_ISSUE_NUMBER;

  // Get the issue
  const { data: issue } = await octokit.issues.get({
    owner,
    repo: repoName,
    issue_number: issueNumber
  });

  // Check if the closed issue is a task
  if (issue.labels.some(label => label.name === 'task')) {
    const workItem = await getLinkedWorkItem(issue, owner, repoName);
    if (workItem) {
      const tasks = await getLinkedTasks(workItem, owner, repoName);
      const allTasksClosed = tasks.every(task => task.state === 'closed');

      if (allTasksClosed) {
        // Update the work item's status to closed
        await octokit.issues.update({
          owner,
          repo: repoName,
          issue_number: workItem.number,
          state: 'closed'
        });
      }
    }
  }
}

async function getLinkedWorkItem(issue, owner, repo) {
  // Find the label that starts with 'work-item-'
  const workItemLabel = issue.labels.find(label => label.name.startsWith('work-item-'));
  if (workItemLabel) {
    const workItemNumber = parseInt(workItemLabel.name.replace('work-item-', ''), 10);
    // Get the work item issue
    const { data: workItem } = await octokit.issues.get({
      owner,
      repo,
      issue_number: workItemNumber
    });
    return workItem;
  }
  return null;
}

async function getLinkedTasks(workItem, owner, repo) {
  // Get all issues in the repository
  const { data: issues } = await octokit.issues.listForRepo({
    owner,
    repo,
    state: 'all'
  });

  // Filter issues to find tasks linked to the work item
  const tasks = issues.filter(issue => 
    issue.labels.some(label => label.name === `work-item-${workItem.number}`)
  );
  return tasks;
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
