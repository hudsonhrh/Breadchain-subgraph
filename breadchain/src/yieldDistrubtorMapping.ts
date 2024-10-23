import { BigInt, Address, Bytes, log } from "@graphprotocol/graph-ts";
import {
  YieldDistributed,
  BreadHolderVoted,
  ProjectAdded,
  ProjectRemoved,
} from "../generated/YieldDistributor/YieldDistributor";
import {
  User,
  VoteEvent,
  YieldDistributionEvent,
  YieldDistributor,
  Project,
  ProjectDistribution,
  ProjectAddedEvent,
  ProjectRemovedEvent,
} from "../generated/schema";


// Helper function to load or create a YieldDistributor
function loadOrCreateYieldDistributor(id: string): YieldDistributor {
    let distributor = YieldDistributor.load(id);
    if (distributor == null) {
      distributor = new YieldDistributor(id);
      distributor.totalYieldDistributed = BigInt.zero();
      distributor.totalVotes = BigInt.zero();
      distributor.projects = [];
    }
    return distributor;
  }
  
  // Helper function to load or create a Project
  function loadOrCreateProject(address: Bytes): Project {
    let id = address.toHex();
    let project = Project.load(id);
    if (project == null) {
      project = new Project(id);
      project.address = address;
      project.totalReceivedYield = BigInt.zero();
      project.save();
    }
    return project;
  }

// Helper function to load or create a User
function loadOrCreateUser(userId: string): User {
  let user = User.load(userId);
  if (user == null) {
    user = new User(userId);
    user.balance = BigInt.zero();
    user.totalSent = BigInt.zero();
    user.totalReceived = BigInt.zero();
    user.totalMinted = BigInt.zero();
    user.totalBurned = BigInt.zero();
    user.totalYieldClaimed = BigInt.zero();
    user.transactionCount = 0;
    user.votesDelegated = BigInt.zero();
    user.delegatesTo = null;

    // Initialize voter-related fields
    user.votes = BigInt.zero();
    user.lastVotedBlock = BigInt.zero();
    user.distributions = new Array<BigInt>();
  }
  return user;
}

export function handleYieldDistributed(event: YieldDistributed): void {
    let distributor = loadOrCreateYieldDistributor(event.address.toHex());
    distributor.totalYieldDistributed = distributor.totalYieldDistributed.plus(event.params.yieldAmount);
  
    // Create YieldDistributionEvent
    let distributionEventId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
    let distributionEvent = new YieldDistributionEvent(distributionEventId);
    distributionEvent.yieldDistributor = distributor.id;
    distributionEvent.totalYield = event.params.yieldAmount;
    distributionEvent.totalVotes = event.params.totalVotes;
    distributionEvent.blockNumber = event.block.number;
    distributionEvent.timestamp = event.block.timestamp;
    distributionEvent.transactionHash = event.transaction.hash;
  
    // Process project distributions
    let projectDistributions = event.params.projectDistributions;
  
    // Get the list of projects from the distributor entity
    let projects = distributor.projects;
  
    // Ensure the projects and distributions arrays are the same length
    if (projects.length != projectDistributions.length) {
      // Log an error or handle the mismatch appropriately
      return;
    }
  
    // Initialize projectDistributions array
    distributionEvent.projectDistributions = [];
  
    for (let i = 0; i < projectDistributions.length; i++) {
      let projectId = projects[i];
      let project = Project.load(projectId);
      if (project == null) {
        // Skip if the project is not found
        continue;
      }
  
      // Update project's totalReceivedYield
      let amount = projectDistributions[i];
      project.totalReceivedYield = project.totalReceivedYield.plus(amount);
      project.save();
  
      // Create ProjectDistribution
      let projectDistributionId = distributionEventId + "-" + i.toString();
      let projectDistribution = new ProjectDistribution(projectDistributionId);
      projectDistribution.project = project.id;
      projectDistribution.yieldDistributionEvent = distributionEvent.id;
      projectDistribution.amount = amount;
      projectDistribution.save();
  
      // Add to distributionEvent's projectDistributions
      let pdList = distributionEvent.projectDistributions;
      pdList.push(projectDistribution.id);
      distributionEvent.projectDistributions = pdList;
    }
  
    distributionEvent.save();
    distributor.save();
  }
  
  

  export function handleBreadHolderVoted(event: BreadHolderVoted): void {
    let voterAddress = event.params.account.toHex();
    let user = loadOrCreateUser(voterAddress);
  
    // Update user properties
    user.lastVotedBlock = event.block.number;
    user.transactionCount = user.transactionCount + 1;
    user.save();
  
    let distributor = loadOrCreateYieldDistributor(event.address.toHex());

    // Add one to the vote count
    distributor.totalVotes = distributor.totalVotes.plus(BigInt.fromI32(1));

    // Create a new VoteEvent
    let voteEvent = new VoteEvent(
      event.transaction.hash.toHex() + "-" + event.logIndex.toString()
    );
    voteEvent.voter = user.id;
    voteEvent.yieldDistributor = distributor.id;
    voteEvent.points = event.params.points.map<BigInt>((point) => point);
  
    // Map the projects from the event parameters
    let projectAddresses = event.params.projects;
    let projectIds: string[] = projectAddresses.map<string>((project) => project.toHex());
  
    // Ensure the points and projects arrays are the same length
    if (voteEvent.points.length != projectIds.length) {
      log.warning("Mismatch in points and projects array lengths: points {}, projects {}", [
        voteEvent.points.length.toString(),
        projectIds.length.toString(),
      ]);
      return;
    }
  
    // Load or create Project entities and collect their IDs
    let projects: string[] = [];
    for (let i = 0; i < projectIds.length; i++) {
      let projectAddress = projectAddresses[i];
      let project = loadOrCreateProject(projectAddress);
      projects.push(project.id);
  
      // Optionally, add the project to the distributor's projects list if not already present
      if (!distributor.projects.includes(project.id)) {
        let distributorProjects = distributor.projects;
        distributorProjects.push(project.id);
        distributor.projects = distributorProjects;
      }
    }
  
    // Save the updated distributor
    distributor.save();
  
    // Associate projects with the vote event
    voteEvent.projects = projects;
  
    // Set event metadata
    voteEvent.blockNumber = event.block.number;
    voteEvent.timestamp = event.block.timestamp;
    voteEvent.transactionHash = event.transaction.hash;
  
    // Save the VoteEvent
    voteEvent.save();
  
    log.info("VoteEvent created with ID: {}", [voteEvent.id]);
  }
  
  
  export function handleProjectAdded(event: ProjectAdded): void {
    let distributor = loadOrCreateYieldDistributor(event.address.toHex());
    let project = loadOrCreateProject(event.params.project);
  
    // Add the project to the distributor's projects list if not already present
    let projects = distributor.projects;
    if (!projects.includes(project.id)) {
      projects.push(project.id);
      distributor.projects = projects;
      distributor.save();
    }
  
    // Create ProjectAddedEvent entity
    let eventId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
    let projectAddedEvent = new ProjectAddedEvent(eventId);
    projectAddedEvent.project = project.id;
    projectAddedEvent.yieldDistributor = distributor.id;
    projectAddedEvent.blockNumber = event.block.number;
    projectAddedEvent.timestamp = event.block.timestamp;
    projectAddedEvent.transactionHash = event.transaction.hash;
    projectAddedEvent.save();
  }

  export function handleProjectRemoved(event: ProjectRemoved): void {
    let distributor = loadOrCreateYieldDistributor(event.address.toHex());
    let projectId = event.params.project.toHex();
  
    // Remove the project from the distributor's projects list if present
    let projects = distributor.projects;
    let index = projects.indexOf(projectId);
    if (index >= 0) {
      projects.splice(index, 1);
      distributor.projects = projects;
      distributor.save();
    }
  
    // Create ProjectRemovedEvent entity
    let eventId = event.transaction.hash.toHex() + "-" + event.logIndex.toString();
    let projectRemovedEvent = new ProjectRemovedEvent(eventId);
    projectRemovedEvent.project = projectId;
    projectRemovedEvent.yieldDistributor = distributor.id;
    projectRemovedEvent.blockNumber = event.block.number;
    projectRemovedEvent.timestamp = event.block.timestamp;
    projectRemovedEvent.transactionHash = event.transaction.hash;
    projectRemovedEvent.save();
  }
  
  
  
