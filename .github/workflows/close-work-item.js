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
  // Get the timeline events for the issue
  const { data: events } = await octokit.issues.listEventsForTimeline({
    owner,
    repo,
    issue_number: issue.number
  });

  // Find the 'cross-referenced' event where the source is the work item
  const crossReferencedEvent = events.find(event => 
    event.event === 'cross-referenced' && 
    event.source.issue.number === issue.number
  );

  if (crossReferencedEvent) {
    // Get the work item issue
    const { data: workItem } = await octokit.issues.get({
      owner,
      repo,
      issue_number: crossReferencedEvent.source.issue.number
    });
    return workItem;
  }
  return null;
}

async function getLinkedTasks(workItem, owner, repo) {
  // Get the timeline events for the work item
  const { data: events } = await octokit.issues.listEventsForTimeline({
    owner,
    repo,
    issue_number: workItem.number
  });

  // Find all 'cross-referenced' events where the target is a task
  const taskEvents = events.filter(event => 
    event.event === 'cross-referenced' && 
    event.source.issue.number === workItem.number
  );

  // Get the task issues
  const tasks = await Promise.all(taskEvents.map(async event => {
    const { data: task } = await octokit.issues.get({
      owner,
      repo,
      issue_number: event.target.issue.number
    });
    return task;
  }));

  return tasks;
}

run().catch(error => {
  console.error(error);
  process.exit(1);
});
