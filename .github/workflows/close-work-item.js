const { Octokit } = require("@octokit/rest");
const octokit = new Octokit({ auth: process.env.GITHUB_TOKEN });

async function getLinkedWorkItem(issue) {
  // Find the label that starts with 'work-item-'
  const workItemLabel = issue.labels.find(label => label.name.startsWith('work-item-'));
  if (workItemLabel) {
    const workItemNumber = parseInt(workItemLabel.name.replace('work-item-', ''), 10);
    // Get the work item issue
    const { data: workItem } = await octokit.issues.get({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: workItemNumber
    });
    return workItem;
  }
  return null;
}

async function getLinkedTasks(workItem) {
  // Get all issues in the repository
  const { data: issues } = await octokit.issues.listForRepo({
    owner: context.repo.owner,
    repo: context.repo.repo,
    state: 'all'
  });

  // Filter issues to find tasks linked to the work item
  const tasks = issues.filter(issue => 
    issue.labels.some(label => label.name === `work-item-${workItem.number}`)
  );
  return tasks;
}

async function run() {
  const context = github.context;
  const issue = context.payload.issue;

  // Check if the closed issue is a task
  if (issue.labels.includes('task')) {
    const workItem = await getLinkedWorkItem(issue);
    if (workItem) {
      const tasks = await getLinkedTasks(workItem);
      const allTasksClosed = tasks.every(task => task.state === 'closed');

      if (allTasksClosed) {
        // Update the work item's status to closed
        await octokit.issues.update({
          owner: context.repo.owner,
          repo: context.repo.repo,
          issue_number: workItem.number,
          state: 'closed'
        });
      }
    }
  }
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
